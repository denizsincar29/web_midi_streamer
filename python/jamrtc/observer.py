"""Listening in on a room without becoming a participant.

The whole point is that participants must not have to do anything. A web player
only ever talks to peers the hub told it about, and the hub builds that list
from the peers already in the room at join time (``Hub.join`` in
``signaler/main.go``). So an observer that never joins the roster is invisible
to the browsers — and that cuts both ways: nobody will ever offer to us. We must
be the side that offers, which is only true if we are the impolite side, so the
observer's peer id has to sort after every id the web client can generate
(``zz-…`` against ``midi-…``).

The cost of being reachable is that the hub does count us in the room, which
raises ``peerCount`` and would surface the room in ``/rooms``. ``hide_room()``
asks the hub to leave us out of the listing; it is best-effort, because the hub
only knows a room once someone has joined it and returns ``{"ok": false}``
otherwise.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Iterable, Optional
from urllib.parse import quote

import urllib.request

from . import protocol
from .peer import Peer

log = logging.getLogger("jamrtc")


class RoomObserver(Peer):
    """A peer that listens to every player in a room and answers their offers.

    ::

        obs = jamrtc.RoomObserver("studio", host="jamrtc.denizsincar.ru")
        obs.on_midi = lambda midi, peer: print(peer, protocol.describe_midi(midi))
        await obs.connect()
        await obs.wait_connected()      # a player has to be in the room

    Every participant is a separate link, so ``on_midi`` fires per player and
    the peer id in the callback tells you who played what. ``relay_to_all()``
    forwards one player's notes to the others — that is how the observer doubles
    as a room-wide relay when no browser is doing it.
    """

    def __init__(
        self,
        room: str,
        host: Optional[str] = None,
        *,
        nickname: Optional[str] = None,
        announce: bool = False,
        hide_room: bool = True,
        secure: bool = True,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            room=room,
            nickname=nickname,
            anonymous=not announce,
            role=protocol.ROLE_OBSERVER if announce else protocol.ROLE_PLAYER,
            **kwargs,
        )
        self.host = host
        self.secure = secure
        self.hide_room = hide_room
        self._hidden = False
        self._hello_seen: dict[str, dict] = {}

        self.on_players: Optional[Callable[[dict[str, str]], Any]] = None
        self._base_on_message = self.on_message
        self.on_message = self._on_app_message

    # ── connection ──────────────────────────────────────────────────────────

    async def connect(self, host: Optional[str] = None, *, secure: Optional[bool] = None, timeout: float = 20.0):
        """Join and, if anonymous, ask the hub to keep the room off the listing.

        ``hide_room`` runs as a background task: the hub only hides a room that
        exists, and it exists the moment our socket lands, so a short retry loop
        is what makes the listing clean rather than a race the caller has to win.
        """
        await super().connect(host or self.host, secure=self.secure if secure is None else secure, timeout=timeout)
        if self.hide_room and self.anonymous:
            self._spawn(self._hide_room_loop())
        return self

    async def _hide_room_loop(self) -> None:
        scheme = "https" if self.secure else "http"
        url = f"{scheme}://{self.host}/hide-room?room={quote(self.room, safe='')}"
        for attempt in range(10):
            try:
                ok = await asyncio.to_thread(self._post_hide, url)
                if ok:
                    self._hidden = True
                    log.info("room %r hidden from the listing", self.room)
                    return
            except Exception as exc:
                log.debug("hide-room attempt %d failed: %s", attempt + 1, exc)
            await asyncio.sleep(0.5 * (attempt + 1))
        log.info("room %r not hidden (no sign of the room yet)", self.room)

    @staticmethod
    def _post_hide(url: str) -> bool:
        request = urllib.request.Request(url, method="POST", data=b"")
        with urllib.request.urlopen(request, timeout=5.0) as response:
            payload = json.loads(response.read() or b"{}")
        return bool(payload.get("ok"))

    # ── roster ──────────────────────────────────────────────────────────────

    def players(self) -> dict[str, Optional[str]]:
        """Map of peer id → nickname, as far as the room has announced itself."""
        return {rid: link.nickname for rid, link in self.links.items() if link.connected}

    def _on_app_message(self, msg: dict, peer_id: str) -> None:
        if msg.get("type") == "hello":
            data = msg.get("data") or {}
            self._hello_seen[peer_id] = data
            if self.on_players:
                self._fire(self.on_players, self.players())
        if self._base_on_message:
            self._fire(self._base_on_message, msg, peer_id)

    # ── relay ───────────────────────────────────────────────────────────────

    async def relay(self, midi: bytes, from_peer: str) -> int:
        """Forward ``midi`` to every peer except ``from_peer``.

        Returns how many peers got it. The origin is skipped so a player does
        not hear their own note come back — the same rule the browser applies
        when it echoes. An observer that relays is a working fallback for a room
        where the peer-to-peer mesh did not fully form.
        """
        origin = self.links.get(from_peer)
        targets = [l for l in self.links.values() if l.connected and l.channel and l.remote_id != from_peer]
        # Carry the sender's timestamp through instead of dropping it: the
        # receiver's latency maths only works while the frame keeps the clock it
        # was stamped with, and re-stamping it with ours would be a lie.
        frame = protocol.encode_midi_frame(midi, getattr(origin, "last_midi_timestamp", None))
        for link in targets:
            link.channel.send(frame)
        return len(targets)

    def relay_loop(self) -> Callable[[bytes, str], None]:
        """Install relay as the ``on_midi`` handler and return it.

        Kept as a method so a caller can wrap it::

            obs.on_midi = lambda midi, peer: (print(peer), obs.relay(midi, peer))
        """
        async def _handler(midi: bytes, peer_id: str) -> None:
            await self.relay(midi, peer_id)

        def _install(midi: bytes, peer_id: str) -> None:
            self._spawn(_handler(midi, peer_id))

        self.on_midi = _install
        return _install


def observe(
    room: str,
    host: str,
    *,
    duration: Optional[float] = None,
    print_midi: bool = True,
    secure: bool = True,
    **kwargs: Any,
) -> "ObserveSession":
    """Convenience opener mirroring ``mido.open_input`` in spirit.

    Returns an object usable as a context manager or awaited directly::

        async with jamrtc.observe("studio", host) as obs:
            async for midi, peer in obs.stream():
                print(peer, midi)
    """
    return ObserveSession(room, host, duration=duration, print_midi=print_midi, secure=secure, **kwargs)


class ObserveSession:
    """Context-manager wrapper around :class:`RoomObserver`."""

    def __init__(self, room: str, host: str, *, duration: Optional[float] = None, print_midi: bool = True, secure: bool = True, **kwargs: Any) -> None:
        self.observer = RoomObserver(room, host=host, secure=secure, **kwargs)
        self.duration = duration
        self.print_midi = print_midi
        self._queue: asyncio.Queue = asyncio.Queue()
        self.observer.on_midi = self._on_midi

    def _on_midi(self, midi: bytes, peer_id: str) -> None:
        self._queue.put_nowait((midi, peer_id))

    async def __aenter__(self) -> RoomObserver:
        await self.observer.connect()
        return self.observer

    async def __aexit__(self, *exc) -> None:
        await self.observer.close()

    async def stream(self):
        """Yield ``(midi_bytes, peer_id)`` as notes arrive."""
        while True:
            yield await self._queue.get()
