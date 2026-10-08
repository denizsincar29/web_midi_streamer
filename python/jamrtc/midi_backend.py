"""Mido backends for JamRTC — MIDI in and out through a WebRTC room.

These are ordinary ``mido`` ports, so an existing script keeps its shape:

    import mido, jamrtc

    out = jamrtc.JamRTCOutput(room="studio", host="jamrtc.denizsincar.ru")
    inp = jamrtc.JamRTCInput(room="studio", host="jamrtc.denizsincar.ru")

    for msg in inp:            # every note played in the room
        out.send(msg)          # relay it back out

Both ports run their own asyncio loop in a daemon thread, because ``mido``'s
API is synchronous and blocking by design and callers expect ``port.send()`` to
return immediately. The peer object itself stays pure asyncio; this module is
the synchronous shell around it.
"""

from __future__ import annotations

import asyncio
import logging
import queue
import threading
import time
from typing import Any, Callable, Iterable, Optional

import mido

from .peer import Peer

log = logging.getLogger("jamrtc")

# The browser sends each MIDI message as its own frame; anything larger is a
# sysex dump. This matches mido's own default and keeps a rogue peer from
# queueing unbounded memory in the receiver.
MAX_MESSAGE_BYTES = 1024


class _EventLoopThread:
    """A private asyncio loop on a daemon thread.

    The loop is created in the thread that runs it, so it is bound to the right
    thread from the start — creating it in ``__init__`` and running it elsewhere
    is the classic asyncio foot-gun.
    """

    def __init__(self, name: str) -> None:
        self._name = name
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._ready = threading.Event()

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name=self._name, daemon=True)
        self._thread.start()
        self._ready.wait(timeout=5.0)

    def _run(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()

    @property
    def loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is None:
            raise RuntimeError("event loop thread not started")
        return self._loop

    def run(self, coro, timeout: Optional[float] = None):
        """Submit a coroutine and block until it finishes (or times out)."""
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return future.result(timeout=timeout)

    def spawn(self, coro) -> None:
        """Fire-and-forget a coroutine on the loop."""
        asyncio.run_coroutine_threadsafe(coro, self.loop)

    def stop(self) -> None:
        if self._loop is None:
            return
        # Cancel our tasks first. ``loop.stop()`` only ends run_forever(); any
        # coroutine still sleeping in it is dead weight that asyncio reports as
        # a destroyed pending task, and a daemon thread holding a half-closed
        # peer is worse than a noisy log line.
        async def _drain() -> None:
            for task in [t for t in asyncio.all_tasks(self._loop) if t is not asyncio.current_task()]:
                task.cancel()
            await asyncio.gather(
                *(t for t in asyncio.all_tasks(self._loop) if t is not asyncio.current_task()),
                return_exceptions=True,
            )

        try:
            asyncio.run_coroutine_threadsafe(_drain(), self._loop).result(timeout=3.0)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread is not None:
            self._thread.join(timeout=3.0)
        self._thread = None
        self._loop = None


class _JamRTCPortBase:
    """Shared plumbing: a peer, a loop thread, and connection state."""

    # mido's BasePort decides whether it is being constructed a second time by
    # checking ``hasattr(self, 'closed')`` — and a ``closed`` property on the
    # subclass answers that check before the base constructor has ever run, so
    # the base returns immediately and the port is left without a name, a lock
    # or a real closed flag. These classes therefore track ``_closed_port``
    # themselves and expose it as a plain attribute, keeping ``hasattr`` false
    # at construction time.
    _closed_port: bool = False

    def __init__(
        self,
        room: str,
        host: str,
        *,
        nickname: Optional[str] = None,
        anonymous: bool = False,
        secure: bool = True,
        peer_id: Optional[str] = None,
        connect: bool = True,
        connect_timeout: float = 20.0,
    ) -> None:
        self.room = room
        self.host = host
        self.anonymous = anonymous
        self._ready = threading.Event()
        self._worker = _EventLoopThread(f"jamrtc-{room}")
        self._worker.start()

        self.peer = Peer(
            room=room,
            peer_id=peer_id,
            nickname=nickname,
            anonymous=anonymous,
            role="observer" if anonymous else "player",
        )
        self.peer.on_peer_connect = self._on_peer_connect
        self.peer.on_peer_disconnect = self._on_peer_disconnect
        self.peer.on_midi = self._on_midi

        if connect:
            self.connect(secure=secure, timeout=connect_timeout)

    # ── lifecycle ───────────────────────────────────────────────────────────

    def connect(self, *, secure: bool = True, timeout: float = 20.0) -> None:
        """Join the room; returns once the link is live (or times out)."""
        try:
            self._worker.run(self.peer.connect(self.host, secure=secure), timeout=timeout)
        except Exception as exc:
            self._closed_port = True
            raise ConnectionError(f"could not join room {self.room!r}: {exc}") from exc
        return None

    def wait(self, timeout: float = 30.0) -> bool:
        """Block until the first peer connects. ``False`` on timeout."""
        return self._ready.wait(timeout=timeout)

    def close(self) -> None:
        """Leave the room and tear down the thread. Safe to call twice."""
        if self._closed_port:
            return
        self._closed_port = True
        # mido's contract: ``closed`` is a plain attribute the caller reads.
        # It is set here rather than by the base class because overriding it as
        # a property is exactly what breaks BasePort's construction check.
        self.closed = True
        try:
            self._worker.run(self.peer.close(), timeout=5.0)
        except Exception as exc:
            log.debug("close failed: %s", exc)
        self._worker.stop()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def __del__(self):  # a port dropped without close() should not leak a thread
        try:
            self.close()
        except Exception:
            pass

    # ── peer callbacks ──────────────────────────────────────────────────────

    def _on_peer_connect(self, link) -> None:
        self._ready.set()

    def _on_peer_disconnect(self, link) -> None:
        pass

    def _on_midi(self, midi: bytes, peer_id: str) -> None:
        pass


class JamRTCInput(_JamRTCPortBase, mido.ports.BaseInput):
    """A ``mido`` input port fed by the room.

    Iterating yields ``mido.Message`` objects as they arrive from any peer::

        for msg in inp:
            if not msg.is_meta:
                ...

    ``relay=True`` turns it into a pass-through: every inbound message is
    forwarded to the other peers, minus the one it came from, so two rooms (or a
    room and your own DAW) mirror each other. That is the "ретранслировать" case
    — the sender never hears its own notes come back.
    """

    def __init__(
        self,
        room: str,
        host: str,
        *,
        relay: bool = False,
        end: bool = True,
        **kwargs: Any,
    ) -> None:
        self._queue: "queue.Queue[mido.Message]" = queue.Queue()
        self.relay = relay
        # ``end`` is accepted for signature parity with mido.open_input, where
        # it controls the input thread; here the port is closed by us, and an
        # inbound ``end_of_track`` must not silently kill the queue.
        self.end = end
        mido.ports.BaseInput.__init__(self, name=f"JamRTC {room}")
        _JamRTCPortBase.__init__(self, room, host, **kwargs)

    # ── mido port surface ───────────────────────────────────────────────────

    def _on_midi(self, midi: bytes, peer_id: str) -> None:
        try:
            msg = mido.Message.from_bytes(bytes(midi))
        except Exception as exc:
            log.warning("undecodable MIDI from %s: %s", peer_id[:12], exc)
            return
        self._queue.put(msg)
        if self.relay:
            self._worker.spawn(self._relay(msg, peer_id))

    def _relay(self, msg: mido.Message, peer_id: str):
        async def _run() -> None:
            for rid, link in list(self.peer.links.items()):
                if rid == peer_id or not link.connected:
                    continue
                try:
                    await self.peer.send_midi_to(rid, msg)
                except Exception as exc:
                    log.debug("relay to %s failed: %s", rid[:12], exc)

        return _run()

    def poll(self):
        """Non-blocking: ``None`` when nothing is waiting."""
        try:
            return self._queue.get_nowait()
        except queue.Empty:
            return None

    def receive(self, block: bool = True):
        """Next message, blocking by default — parity with ``mido`` ports."""
        if block:
            return self._queue.get()
        return self.poll()

    def close(self) -> None:
        _JamRTCPortBase.close(self)

    def __iter__(self):
        while not self.closed:
            msg = self.poll()
            if msg is None:
                time.sleep(0.002)
                continue
            yield msg


class JamRTCOutput(_JamRTCPortBase, mido.ports.BaseOutput):
    """A ``mido`` output port that broadcasts to the whole room.

    ``panics()`` sends all-notes-off on every channel first, which is what you
    want before closing a port mid-note — otherwise a stuck note plays on every
    other peer forever.
    """

    def __init__(self, room: str, host: str, **kwargs: Any) -> None:
        mido.ports.BaseOutput.__init__(self, name=f"JamRTC {room}")
        _JamRTCPortBase.__init__(self, room, host, **kwargs)
        # Announce presence once the first link is up, so players see us in the
        # room list the way they see each other.
        self._worker.spawn(self._announce_when_ready())

    async def _announce_when_ready(self) -> None:
        if self.anonymous:
            return
        for _ in range(300):  # ~30 s
            if self._closed_port:
                return
            if any(l.connected for l in self.peer.links.values()):
                await self.peer.announce_presence()
                return
            await asyncio.sleep(0.1)

    def send(self, msg: Any) -> None:
        """Queue one message for the room. Never blocks on the network."""
        if self._closed_port:
            raise ValueError("port is closed")
        if isinstance(msg, mido.MetaMessage):
            return  # meta events are local file bookkeeping, not wire data
        if isinstance(msg, mido.Message):
            data = msg.bin()
        elif isinstance(msg, (bytes, bytearray)):
            data = bytes(msg)
        elif isinstance(msg, Iterable):
            data = b"".join(m.bin() if isinstance(m, mido.Message) else bytes(m) for m in msg)
        else:
            raise TypeError(f"cannot send {type(msg).__name__}")
        if len(data) > MAX_MESSAGE_BYTES:
            raise ValueError(f"MIDI message too large: {len(data)} bytes")
        self._worker.spawn(self.peer.send_midi(data))

    def panic(self) -> None:
        """All-notes-off plus all-sound-off on all 16 channels."""
        for channel in range(16):
            self.send(mido.Message("control_change", channel=channel, control=123, value=0))
            self.send(mido.Message("control_change", channel=channel, control=120, value=0))

    def reset(self) -> None:
        self.panic()

    def close(self) -> None:
        if self._closed_port:
            return
        try:
            self.panic()
            time.sleep(0.05)  # let the panic frames leave before the socket dies
        except Exception:
            pass
        _JamRTCPortBase.close(self)


class JamRTCIo(_JamRTCPortBase, mido.ports.BaseIOPort):
    """Input and output on one connection — one peer, two directions.

    Preferred over separate input/output ports: two ports would be two peers in
    the room, arriving as two participants to everyone else.
    """

    def __init__(self, room: str, host: str, **kwargs: Any) -> None:
        self._queue: "queue.Queue[mido.Message]" = queue.Queue()
        self._last_peer: dict[str, float] = {}
        mido.ports.BaseIOPort.__init__(self, name=f"JamRTC {room}")
        _JamRTCPortBase.__init__(self, room, host, **kwargs)
        self._worker.spawn(self._announce_when_ready())

    async def _announce_when_ready(self) -> None:
        if self.anonymous:
            return
        for _ in range(300):
            if self._closed_port:
                return
            if any(l.connected for l in self.peer.links.values()):
                await self.peer.announce_presence()
                return
            await asyncio.sleep(0.1)

    def _on_midi(self, midi: bytes, peer_id: str) -> None:
        try:
            self._queue.put(mido.Message.from_bytes(bytes(midi)))
        except Exception as exc:
            log.warning("undecodable MIDI from %s: %s", peer_id[:12], exc)

    def send(self, msg: Any) -> None:
        if self._closed_port:
            raise ValueError("port is closed")
        if isinstance(msg, mido.MetaMessage):
            return
        if isinstance(msg, mido.Message):
            data = msg.bin()
        elif isinstance(msg, (bytes, bytearray)):
            data = bytes(msg)
        else:
            raise TypeError(f"cannot send {type(msg).__name__}")
        if len(data) > MAX_MESSAGE_BYTES:
            raise ValueError(f"MIDI message too large: {len(data)} bytes")
        self._worker.spawn(self.peer.send_midi(data))

    def poll(self):
        try:
            return self._queue.get_nowait()
        except queue.Empty:
            return None

    def receive(self, block: bool = True):
        if block:
            return self._queue.get()
        return self.poll()

    def panic(self) -> None:
        for channel in range(16):
            self.send(mido.Message("control_change", channel=channel, control=123, value=0))
            self.send(mido.Message("control_change", channel=channel, control=120, value=0))

    def reset(self) -> None:
        self.panic()

    def close(self) -> None:
        if self._closed_port:
            return
        try:
            self.panic()
            time.sleep(0.05)
        except Exception:
            pass
        _JamRTCPortBase.close(self)

    def __iter__(self):
        while not self.closed:
            msg = self.poll()
            if msg is None:
                time.sleep(0.002)
                continue
            yield msg


def open_input(room: str, host: str, **kwargs: Any) -> JamRTCInput:
    """``mido.open_input``-shaped helper."""
    return JamRTCInput(room, host, **kwargs)


def open_output(room: str, host: str, **kwargs: Any) -> JamRTCOutput:
    """``mido.open_output``-shaped helper."""
    return JamRTCOutput(room, host, **kwargs)


def open_ioport(room: str, host: str, **kwargs: Any) -> JamRTCIo:
    """``mido.open_ioport``-shaped helper."""
    return JamRTCIo(room, host, **kwargs)
