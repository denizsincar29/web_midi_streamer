"""A single JamRTC peer: signaling socket, peer connections, data channels.

The shape is dictated by the web client's rules, which we deliberately mirror
instead of inventing our own — two implementations that disagree about who
offers end up with two peers staring at each other and no connection at all:

  * **Polite/impolite.** Both sides compare peer ids as strings; the smaller id
    is polite. Only the impolite side offers and creates the data channel, the
    polite side answers (``_isPolite`` / ``_negotiateWith`` in src/webrtc.js).
  * **Roster-driven.** The hub sends ``peers`` with the full member list and
    ``join`` when somebody arrives; we reconcile our connections against that
    roster rather than trusting a single event (``reconcilePeers``).
  * **Reannounce.** A peer that came back on a new socket tells the hub which
    links it still holds; the hub pokes the dropped ones to re-announce. We send
    the same ``peers`` message so we do not look dead to everyone else.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from typing import Any, Callable, Optional

from aiortc import (
    RTCConfiguration,
    RTCIceCandidate,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.sdp import candidate_from_sdp, candidate_to_sdp

from . import protocol

log = logging.getLogger("jamrtc")

# The hub pings every 30 s and drops a socket that has gone quiet for 120 s, so
# the client heartbeat matches the browser's 25 s (see src/webrtc.js).
KEEPALIVE_INTERVAL = 25.0
# Roster refresh cadence: the hub only pushes on join/leave, and a missed push
# is invisible until something else moves. The browser polls on its own timers;
# we re-reconcile on a slow tick as a cheap safety net.
ROSTER_INTERVAL = 20.0


class PeerLink:
    """One peer connection plus the data channel riding on it."""

    def __init__(self, remote_id: str, polite: bool) -> None:
        self.remote_id = remote_id
        self.polite = polite
        self.pc: Optional[RTCPeerConnection] = None
        self.channel = None
        self.connected = False
        self.nickname: Optional[str] = None
        self.role: Optional[str] = None
        # Timestamp of the last MIDI frame this peer sent us — kept so a relay
        # can re-emit the frame without inventing one (see ``_handle_data``).
        self.last_midi_timestamp: Optional[float] = None
        self._making_offer = False

    def __repr__(self) -> str:
        state = "connected" if self.connected else "connecting"
        whose = "polite" if self.polite else "impolite"
        return f"<PeerLink {self.remote_id[:12]} {whose} {state}>"


class Peer:
    """One participant in a room — the object a user of this library holds.

    Usage::

        peer = jamrtc.Peer(room="studio", nickname="deniz")
        peer.on_midi = lambda midi, peer_id: print(midi, peer_id)
        await peer.connect("jamrtc.denizsincar.ru")
        await peer.send_midi([0x90, 60, 100])
    """

    def __init__(
        self,
        room: str,
        peer_id: Optional[str] = None,
        nickname: Optional[str] = None,
        *,
        role: str = protocol.ROLE_PLAYER,
        anonymous: bool = False,
        ice_servers: Optional[list[RTCIceServer]] = None,
        id_prefix: str = "py",
        host_header: Optional[str] = None,
    ) -> None:
        self.room = room
        self.role = role
        self.host_header = host_header
        # ``anonymous`` is the observer flag: no nickname is announced, we ask
        # the hub to hide the room from listings, and the peer id is chosen so
        # we are never the impolite side (which would mean offering to everyone).
        self.anonymous = anonymous
        self.nickname = None if anonymous else (nickname or "python")
        self.peer_id = peer_id or self._generate_id(id_prefix, anonymous)

        self._ice_servers = ice_servers
        self.links: dict[str, PeerLink] = {}
        self.connected = False
        self.on_midi: Optional[Callable[[bytes, str], Any]] = None
        self.on_message: Optional[Callable[[dict, str], Any]] = None
        self.on_peer_connect: Optional[Callable[[PeerLink], Any]] = None
        self.on_peer_disconnect: Optional[Callable[[PeerLink], Any]] = None
        self.on_status: Optional[Callable[[str], Any]] = None

        self._ws = None
        self._tasks: set[asyncio.Task] = set()
        self._closing = False

    # ── construction helpers ────────────────────────────────────────────────

    @staticmethod
    def _generate_id(prefix: str, anonymous: bool) -> str:
        """A peer id safe for the polite/impolite rule.

        Ids are compared as strings and the ``zz`` prefix sorts after every id
        the web client generates (``midi-…``), so an observer is always polite
        and therefore never offers.
        """
        if anonymous:
            return f"zz-anon-{secrets.token_hex(4)}"
        return f"{prefix}-{int(time.time())}-{secrets.token_hex(3)}"

    def _build_pc(self) -> RTCPeerConnection:
        # aiortc's RTCConfiguration takes no iceCandidatePoolSize — it has no
        # candidate pool at all: setLocalDescription gathers synchronously
        # (``__gather`` → ``RTCIceGatherer.gather``) and the candidates are
        # readable from ``getLocalCandidates`` right after.
        config = RTCConfiguration(iceServers=self._ice_servers or [])
        return RTCPeerConnection(configuration=config)

    @staticmethod
    def _ice_transport(pc: RTCPeerConnection):
        """The ICE transport aiortc is actually using for this connection.

        Everything rides one bundled transport: once SCTP exists the data
        channel owns it, and otherwise it is the first transceiver's. Going
        through ``sctp.transport.transport`` rather than ``pc.iceTransports``
        (a private set) is also what our inbound candidates have to match —
        ``_on_ice`` calls ``addIceCandidate``, which routes by m-line.
        """
        sctp = pc.sctp
        if sctp is not None:
            return sctp.transport.transport
        for transceiver in getattr(pc, "_RTCPeerConnection__transceivers", ()):
            return transceiver.receiver.transport.transport
        return None

    async def _send_ice_candidates(self, link: PeerLink) -> None:
        """Forward our gathered ICE candidates to the peer over signaling.

        aiortc never fires the ``icecandidate`` event — the string does not
        occur anywhere in its peerconnection module. The browser relies on that
        event to trickle candidates, so a Python peer that waits for it sends
        an offer with none, ICE never leaves ``new``, and no data channel ever
        opens. We therefore read the candidates ourselves and push them; the
        gatherer runs synchronously inside ``setLocalDescription``, so by the
        time this is called they are already there.
        """
        transport = self._ice_transport(link.pc)
        if transport is None:
            log.debug("no ICE transport yet for %s", link.remote_id[:12])
            return
        if not transport.iceGatherer._connection.local_candidates:
            await transport.iceGatherer.gather()
        for candidate in transport.iceGatherer.getLocalCandidates():
            await self._send_raw(
                {
                    "type": "ice",
                    "from": self.peer_id,
                    "to": link.remote_id,
                    "candidate": {
                        "candidate": "candidate:" + candidate_to_sdp(candidate),
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    },
                }
            )

    # ── connection ──────────────────────────────────────────────────────────

    async def connect(self, host: str, *, secure: bool = True, timeout: float = 20.0):
        """Join the room. ``host`` is the signaler host, optionally with a port.

        Returns once the signaling socket is open; peer links come up in the
        background and surface through ``on_peer_connect``. ``wait_connected()``
        blocks until at least one peer is live if that is what you want.
        """
        import websockets

        url = protocol.signaling_url(
            host, self.room, self.peer_id, secure=secure, host_header=self.host_header
        )
        url, headers = protocol.parse_signaling_url(url)
        log.info("signaling → %s (room=%s peer=%s)", url, self.room, self.peer_id)

        self._ws = await websockets.connect(
            url,
            ping_interval=None,
            additional_headers=headers or None,
        )
        self._spawn(self._reader_loop())
        self._spawn(self._heartbeat_loop())
        self._spawn(self._roster_loop())
        return self

    async def wait_connected(self, timeout: float = 30.0) -> bool:
        """Block until at least one peer link is open. ``False`` on timeout."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if any(l.connected for l in self.links.values()):
                return True
            await asyncio.sleep(0.1)
        return False

    async def announce_presence(self) -> None:
        """Send our ``hello`` to every open link, like the browser does.

        The browser fires this from ``onPeerConnect``; a listener that joins an
        already-running room and wants to be listed should call it after new
        links open.
        """
        if self.anonymous:
            return
        # A data channel carries strings or bytes, not objects: the browser
        # does the stringify on its side (``JSON.stringify`` in webrtc.js) and
        # a dict handed straight to ``send`` raises. Same wire format, then.
        await self.send(
            protocol.dumps(
                {
                    "type": "hello",
                    "data": {
                        "nickname": self.nickname,
                        "role": self.role,
                        "cacheVersion": "jamrtc-py",
                    },
                }
            )
        )

    async def close(self) -> None:
        """Leave the room and tear every link down."""
        self._closing = True
        for task in list(self._tasks):
            task.cancel()
        for link in list(self.links.values()):
            await self._close_link(link)
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        self.connected = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.close()

    # ── background loops ────────────────────────────────────────────────────

    def _spawn(self, coro) -> None:
        task = asyncio.ensure_future(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _reader_loop(self) -> None:
        ws = self._ws
        try:
            async for raw in ws:
                msg = protocol.parse_signal(raw)
                if msg is not None:
                    await self._handle_signal(msg)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # a dead socket must not take the process down
            if not self._closing:
                log.warning("signaling socket closed: %s", exc)
        finally:
            self.connected = False

    async def _heartbeat_loop(self) -> None:
        while not self._closing:
            await asyncio.sleep(KEEPALIVE_INTERVAL)
            if self._ws is None:
                continue
            try:
                await self._ws.send(
                    protocol.dumps({"type": "keepalive", "from": self.peer_id})
                )
            except Exception:
                return

    async def _roster_loop(self) -> None:
        """Re-tell the hub which links we hold, so it re-pokes stale ones.

        The browser sends this when its roster changes. Sending it periodically
        covers the case where *our* links died silently while our socket stayed
        up: the hub sees peers we no longer talk to and asks them to re-announce,
        which restarts exactly the broken pairs.
        """
        while not self._closing:
            await asyncio.sleep(ROSTER_INTERVAL)
            live = [rid for rid, l in self.links.items() if l.connected]
            try:
                await self._send_raw(
                    {"type": "peers", "from": self.peer_id, "peers": live}
                )
            except Exception:
                return

    # ── signaling ───────────────────────────────────────────────────────────

    async def _send_raw(self, obj: dict) -> None:
        if self._ws is None:
            raise RuntimeError("not connected to the signaler")
        await self._ws.send(protocol.dumps(obj))

    async def send_to(self, remote_id: str, payload: str | bytes) -> None:
        """Send raw text/binary to one peer's data channel."""
        link = self.links.get(remote_id)
        if link is None or link.channel is None or not link.connected:
            raise RuntimeError(f"no open link to {remote_id}")
        link.channel.send(payload)

    async def send(self, payload: str | bytes) -> None:
        """Send to every connected peer on its data channel."""
        targets = [l for l in self.links.values() if l.connected and l.channel]
        if not targets:
            raise RuntimeError("no connected peers")
        for link in targets:
            link.channel.send(payload)

    async def _handle_signal(self, msg: dict) -> None:
        mtype = msg.get("type")

        if mtype == "peers":
            await self._reconcile(msg.get("peers") or [])

        elif mtype == "join":
            # Somebody arrived. The roster message that follows is the authority;
            # this is just a nudge to reconcile early.
            remote = msg.get("from")
            if remote and remote != self.peer_id and msg.get("to") in (None, self.peer_id):
                await self._reconcile(list(self.links) + [remote])

        elif mtype == "reannounce":
            # The hub says a peer we claimed to talk to has gone quiet: say hello
            # again so it offers (or, if we are impolite, we offer).
            if msg.get("to") in (None, self.peer_id):
                await self._send_raw({"type": "join", "from": self.peer_id})

        elif mtype == "sdp":
            if msg.get("to") in (None, self.peer_id):
                await self._on_sdp(msg)

        elif mtype == "ice":
            if msg.get("to") in (None, self.peer_id):
                await self._on_ice(msg)

        else:
            log.debug("ignoring signaling message type=%r", mtype)

    async def _reconcile(self, peer_ids: list[str]) -> None:
        """Match our links against the hub's roster.

        The hub's ``peers`` list is the room *excluding the recipient* — it is a
        "here is who else is here" list, never an echo of ourselves, so our own
        id is never a member to test for. Links the roster leaves out are ones
        the hub no longer knows about: a replaced socket leaves the old links
        pointing at a room we are no longer in, and those have to go.
        """
        for rid in peer_ids:
            if rid == self.peer_id:
                continue
            link = self.links.get(rid)
            if link is not None and (link.connected or link.pc is not None):
                continue  # already up, or negotiation in flight
            await self._negotiate(rid)

    async def _negotiate(self, remote_id: str) -> None:
        """Start a connection to ``remote_id``, honouring politeness.

        Only the impolite side creates the channel and offers; the polite side
        waits for the offer and then creates its own channel in response. When
        both sides offered at the same moment, the polite side rolls its offer
        back (``_on_sdp``) and takes the incoming one.
        """
        link = self.links.get(remote_id)
        if link is None:
            link = PeerLink(remote_id, polite=self._is_polite(remote_id))
            link.pc = self._build_pc()
            link.pc.on("datachannel", lambda channel: self._bind_channel(link, channel))
            link.pc.on("connectionstatechange", lambda: self._spawn(self._on_conn_state(link)))
            self.links[remote_id] = link
        try:
            link._making_offer = True
            # Only the impolite side creates the channel AND offers. The polite
            # side waits for the offer; it must NOT offer here, or both peers
            # put an SDP on the wire at the same moment and the pair deadlocks
            # in glare. A polite link is created in ``_on_sdp`` instead.
            if link.polite:
                log.debug("polite towards %s — waiting for their offer", remote_id[:12])
                return
            if link.channel is None:
                self._create_channel(link)
            await link.pc.setLocalDescription(await link.pc.createOffer())
            # Candidates then go out by hand: aiortc does not fire
            # ``icecandidate``, so nothing would trickle them for us.
            await self._send_ice_candidates(link)
            await self._send_raw(
                {
                    "type": "sdp",
                    "from": self.peer_id,
                    "to": remote_id,
                    "sdp": {
                        "type": link.pc.localDescription.type,
                        "sdp": link.pc.localDescription.sdp,
                    },
                }
            )
        except Exception as exc:
            log.warning("negotiate with %s failed: %s", remote_id, exc)
        finally:
            link._making_offer = False

    async def _on_sdp(self, msg: dict) -> None:
        remote_id = msg.get("from")
        sdp = msg.get("sdp") or {}
        if not isinstance(remote_id, str) or "sdp" not in sdp:
            return
        if remote_id == self.peer_id:
            # The hub broadcasts to the whole room, and under a proxied host a
            # peer's own id comes back with the *internal* loopback address —
            # so the echo looks like a different peer entirely.
            return

        link = self.links.get(remote_id)
        if link is None:
            link = PeerLink(remote_id, polite=self._is_polite(remote_id))
            link.pc = self._build_pc()
            link.pc.on("datachannel", lambda channel: self._bind_channel(link, channel))
            link.pc.on("connectionstatechange", lambda: self._spawn(self._on_conn_state(link)))
            self.links[remote_id] = link

        desc = RTCSessionDescription(sdp=sdp["sdp"], type=sdp["type"])

        if desc.type == "offer":
            # Glare: we are polite and our own offer is still crossing theirs.
            # Roll ours back and accept theirs, exactly as the browser does.
            if link.polite and link.pc.signalingState != "stable":
                log.debug("glare with %s — rolling back our offer", remote_id)
                await link.pc.setLocalDescription(
                    RTCSessionDescription(sdp="", type="rollback")
                )
            await link.pc.setRemoteDescription(desc)
            if link.polite and link.channel is None:
                # The polite side does not create a channel unless the impolite
                # side somehow failed to — it will arrive over ondatachannel.
                log.debug("polite side awaiting data channel from %s", remote_id)
            else:
                # The impolite side created a channel when it offered; here we
                # are that offerer receiving the answer to it, and aiortc does
                # not fire ``datachannel`` for our own channel, so without this
                # the link would report connected while carrying nothing. The
                # browser has the same line — and it creates the channel before
                # setRemoteDescription for the same reason.
                self._create_channel(link)
            answer = await link.pc.createAnswer()
            await link.pc.setLocalDescription(answer)
            await self._send_ice_candidates(link)
            await self._send_raw(
                {
                    "type": "sdp",
                    "from": self.peer_id,
                    "to": remote_id,
                    "sdp": {
                        "type": link.pc.localDescription.type,
                        "sdp": link.pc.localDescription.sdp,
                    },
                }
            )
        else:
            await link.pc.setRemoteDescription(desc)

    async def _on_ice(self, msg: dict) -> None:
        remote_id = msg.get("from")
        cand = msg.get("candidate")
        if remote_id == self.peer_id:
            return  # our own broadcast echo; see ``_on_sdp``
        link = self.links.get(remote_id) if isinstance(remote_id, str) else None
        if link is None or link.pc is None:
            return
        if not cand or cand.get("candidate") == "":
            return  # end-of-candidates marker
        try:
            payload = cand["candidate"]
            if payload.startswith("candidate:"):
                payload = payload[len("candidate:") :]
            ice = candidate_from_sdp(payload)
            # aiortc routes an inbound candidate by m-line: it matches
            # ``sdpMid == transceiver.mid`` or ``sdpMLineIndex == m-line index``,
            # and raises outright when both are None. Our own candidates carry
            # neither — ``candidate_to_sdp`` does not emit them — so a peer built
            # on this library sends exactly that empty pair. Every connection we
            # make has a single bundled transport, so the index is unambiguous.
            mid = cand.get("sdpMid")
            index = cand.get("sdpMLineIndex")
            if mid is not None:
                ice.sdpMid = mid
            if index is not None:
                ice.sdpMLineIndex = index
            if ice.sdpMid is None and ice.sdpMLineIndex is None:
                ice.sdpMLineIndex = 0
            await link.pc.addIceCandidate(ice)
        except Exception as exc:
            log.debug("bad ICE candidate from %s: %s", remote_id, exc)

    async def _on_conn_state(self, link: PeerLink) -> None:
        state = link.pc.connectionState if link.pc else "closed"
        if state in ("failed", "closed"):
            if link.connected:
                link.connected = False
                self._fire(self.on_peer_disconnect, link)
            await self._close_link(link)

    # ── data channel ────────────────────────────────────────────────────────

    def _create_channel(self, link: PeerLink) -> None:
        if link.channel is not None:
            return
        # Same options as the browser: with low latency on, the channel is
        # unordered with no retransmits; otherwise small retransmit budget.
        channel = link.pc.createDataChannel("midi")
        self._bind_channel(link, channel)

    def _bind_channel(self, link: PeerLink, channel) -> None:
        link.channel = channel

        @channel.on("open")
        def _open() -> None:
            link.connected = True
            self.connected = True
            log.info("peer %s connected", link.remote_id[:12])
            self._fire(self.on_peer_connect, link)
            if not self.anonymous:
                self._spawn(self.announce_presence())

        @channel.on("close")
        def _close() -> None:
            if link.connected:
                link.connected = False
                self._fire(self.on_peer_disconnect, link)

        @channel.on("message")
        def _message(data) -> None:
            self._handle_data(link, data)

        # A channel we created ourselves starts opening as soon as SCTP is up,
        # which can be before this handler is attached — the offerer creates its
        # channel and then waits a full signaling round-trip for the answer.
        # The ``open`` event is a one-shot, so missing it leaves the link stuck
        # at ``connected = False`` while the channel is open and carrying data:
        # sends would be refused and every inbound message would still arrive.
        # The state is read directly, exactly once, if the handler got there late.
        if channel.readyState == "open":
            _open()

    def _handle_data(self, link: PeerLink, data: Any) -> None:
        """Dispatch one inbound data-channel message.

        Text is JSON; bytes are a MIDI frame. The browser splits on the same
        line, and the frame's version byte is what keeps a stray byte string
        from being read as MIDI.
        """
        if isinstance(data, memoryview):
            data = bytes(data)

        if isinstance(data, (bytes, bytearray)):
            try:
                midi, ts = protocol.decode_midi_frame(bytes(data))
            except ValueError as exc:
                log.warning("dropping frame from %s: %s", link.remote_id[:12], exc)
                return
            # The timestamp is the sender's clock and goes no further than the
            # callback — but a relay has to put it back on the wire, or the note
            # loses its latency probe the moment it passes through us. It rides
            # on the link until the next message from the same peer.
            link.last_midi_timestamp = ts
            self._fire(self.on_midi, midi, link.remote_id)
            return

        msg = protocol.parse_signal(data)
        if msg is None:
            return
        mtype = msg.get("type")

        if mtype == "hello":
            payload = msg.get("data") or {}
            link.nickname = payload.get("nickname")
            link.role = payload.get("role")
            log.info("hello from %s: %r", link.remote_id[:12], link.nickname)
        elif mtype == "ping":
            # Answer the browser's latency probe so its stats stay honest.
            self._spawn(
                self._safe_send_to(
                    link,
                    protocol.dumps(
                        {
                            "type": "pong",
                            "timestamp": msg.get("timestamp"),
                            "pingId": msg.get("pingId"),
                        }
                    ),
                )
            )
            return
        elif mtype == "pong":
            return
        elif mtype is not None and mtype not in protocol.KNOWN_APP_TYPES:
            log.debug("dropping unknown message type %r", mtype)
            return

        self._fire(self.on_message, msg, link.remote_id)

    async def _safe_send_to(self, link: PeerLink, payload: str) -> None:
        try:
            if link.channel is not None and link.connected:
                link.channel.send(payload)
        except Exception as exc:
            log.debug("send to %s failed: %s", link.remote_id[:12], exc)

    # ── MIDI ────────────────────────────────────────────────────────────────

    async def send_midi(
        self, message: Any, timestamp: Optional[float] = None
    ) -> None:
        """Broadcast a MIDI message to the room.

        ``message`` may be raw bytes (``[0x90, 60, 100]``) or anything ``mido``
        produces — a ``Message`` or a ``MidiFile``/track iterable, whose messages
        are packed in order. The frame goes out as one binary packet, so an
        incoming MIDI stream can be forwarded with a single call per message and
        stays byte-identical to what the browser's worker would emit.
        """
        frame = protocol.encode_midi_frame(_pack_midi(message), timestamp=timestamp)
        targets = [l for l in self.links.values() if l.connected and l.channel]
        for link in targets:
            link.channel.send(frame)

    async def send_midi_to(self, remote_id: str, message: Any) -> None:
        """Send MIDI to one peer only — the relay case."""
        link = self.links.get(remote_id)
        if link is None or link.channel is None or not link.connected:
            raise RuntimeError(f"no open link to {remote_id}")
        link.channel.send(protocol.encode_midi_frame(_pack_midi(message)))

    # ── internals ───────────────────────────────────────────────────────────

    def _is_polite(self, remote_id: str) -> bool:
        """String comparison, matching ``_isPolite`` in src/webrtc.js."""
        return self.peer_id < remote_id

    async def _close_link(self, link: PeerLink) -> None:
        if link.pc is not None:
            try:
                await link.pc.close()
            except Exception:
                pass
            link.pc = None
        link.channel = None
        link.connected = False
        self.links.pop(link.remote_id, None)
        self.connected = any(l.connected for l in self.links.values())

    def _fire(self, callback, *args) -> None:
        if callback is None:
            return
        try:
            result = callback(*args)
        except Exception:
            log.exception("callback raised")
            return
        # Callbacks may be plain functions or coroutine functions; both are fine.
        if asyncio.iscoroutine(result):
            self._spawn(result)


def _pack_midi(message: Any) -> bytes:
    """Normalise bytes / mido objects into raw MIDI bytes.

    Importing ``mido`` here rather than at module import keeps the core usable
    without it — a peer that only relays bytes never needs the MIDI dependency.
    """
    if isinstance(message, (bytes, bytearray, memoryview)):
        return bytes(message)

    # A bare sequence of ints is raw MIDI (``[0x90, 60, 100]``). It has to be
    # caught before the generic iterable branch below, which would otherwise
    # recurse into each ``int`` and try to pack it as a message of its own.
    if isinstance(message, (list, tuple)) and all(
        isinstance(b, int) and not isinstance(b, bool) for b in message
    ):
        return bytes(b & 0xFF for b in message)

    try:
        import mido
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise TypeError(
            f"cannot pack {type(message).__name__}: install mido for MIDI objects"
        ) from exc

    if isinstance(message, mido.Message):
        return message.bin()

    if hasattr(message, "__iter__"):
        buffer = bytearray()
        for item in message:
            buffer.extend(_pack_midi(item))
        return bytes(buffer)

    raise TypeError(f"cannot encode {type(message).__name__} as MIDI")
