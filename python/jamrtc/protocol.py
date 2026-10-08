"""Wire protocol constants and codecs for JamRTC.

Two transports speak here and both are mirrored from the web client, because a
Python peer has to be bit-compatible with a browser peer:

  * the *signaling* socket (JSON text over WebSocket, through the Go signaler),
  * the *data channel* (a compact binary MIDI frame, or JSON app messages).

Frame layout is defined by ``src/midi-worker.js`` on the web side and decoded by
``_handleBinaryPacket`` in ``src/webrtc.js``. ``MIDI_FRAME_VERSION`` in
``src/config.js`` is the authority for the version byte — bump this constant
when that one is bumped, or a receiver will drop every frame we send.
"""

from __future__ import annotations

import json
import struct
from typing import Any, Iterable, Optional

# --- Signaling ---------------------------------------------------------------

SIGNALING_PATH = "/signal"

# Roles decide who creates the data channel. Both sides run the same rule
# (``_isPolite`` in src/webrtc.js): the lexicographically smaller peer id is
# polite. Only the impolite side offers and creates the channel; the polite
# side answers and receives it. An anonymous observer must therefore pick an id
# that is larger than every participant, or it would be the one offering and
# everyone would have to answer a listener.
ROLE_PLAYER = "player"
ROLE_OBSERVER = "observer"

# Messages the web client accepts as typed JSON application messages; anything
# else is dropped with a console warning (``KNOWN_APP_TYPES`` in src/webrtc.js).
# We mirror the set so both directions behave identically.
KNOWN_APP_TYPES = frozenset(
    {"hello", "chat", "settings_sync", "role_change", "test_note", "midi"}
)


# --- MIDI data channel frame -------------------------------------------------

# Mirrors MIDI_FRAME_VERSION in src/config.js.
MIDI_FRAME_VERSION = 2

FLAG_TIMESTAMP = 0x01

_TIMESTAMP_STRUCT = struct.Struct(">d")  # big-endian float64


def encode_midi_frame(midi: Iterable[int], timestamp: Optional[float] = None) -> bytes:
    """Pack raw MIDI bytes into a versioned frame.

    Layout (see src/midi-worker.js):

        [0]          protocol version
        [1]          flags, bit 0 = timestamp present
        [2:10]       float64, big-endian — only when the flag is set
        [10:] or [2:] raw MIDI bytes

    A timestamp is milliseconds on the *sender's* clock (the browser uses
    ``performance.now()``). It is an advisory latency probe, not an ordering
    key; when unsure, send without one and the receiver just gets ``None``.
    """
    payload = bytes(midi)
    if timestamp is None:
        return bytes([MIDI_FRAME_VERSION, 0x00]) + payload
    return (
        bytes([MIDI_FRAME_VERSION, FLAG_TIMESTAMP])
        + _TIMESTAMP_STRUCT.pack(float(timestamp))
        + payload
    )


def decode_midi_frame(data: bytes) -> tuple[bytes, Optional[float]]:
    """Split a frame into ``(midi_bytes, timestamp)``.

    Legacy frames from older clients had no version byte — byte 0 was the flags.
    Flags only ever set bit 0, so 0x00/0x01 stay unambiguous and we decode them
    exactly as the browser does. Raises ``ValueError`` on a frame we cannot
    trust rather than guessing at the offset and emitting garbage as MIDI.
    """
    if not data:
        raise ValueError("empty MIDI frame")

    first = data[0]
    if first == MIDI_FRAME_VERSION:
        if len(data) < 2:
            raise ValueError("truncated MIDI frame header")
        flags = data[1]
        offset = 2
    elif first in (0x00, 0x01):
        flags = first
        offset = 1
    else:
        raise ValueError(f"unknown MIDI frame version 0x{first:02x}")

    timestamp: Optional[float] = None
    if flags & FLAG_TIMESTAMP:
        if len(data) < offset + 8:
            raise ValueError("truncated MIDI frame timestamp")
        (timestamp,) = _TIMESTAMP_STRUCT.unpack_from(data, offset)
        offset += 8

    if len(data) < offset:
        raise ValueError("truncated MIDI frame payload")
    return data[offset:], timestamp


# --- Signaling messages ------------------------------------------------------


def dumps(obj: Any) -> str:
    """JSON for the signaling socket, compact — the Go hub relays bytes as-is."""
    return json.dumps(obj, separators=(",", ":"))


def parse_signal(raw: str) -> Optional[dict]:
    """Parse an inbound signaling message; ``None`` for anything unusable.

    The hub only ever sends JSON objects, but a malformed line should not kill
    the receive loop — a dropped socket costs a reconnect, a raised exception
    costs the caller's whole session.
    """
    try:
        msg = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return msg if isinstance(msg, dict) else None


def signaling_url(
    host: str,
    room: str,
    peer: str,
    *,
    secure: bool = True,
    path: str = SIGNALING_PATH,
    host_header: Optional[str] = None,
) -> str:
    """Build the ``wss://…/signal?room=…&peer=…`` URL the hub expects.

    ``host`` may carry a port (``jamrtc.denizsincar.ru`` or ``localhost:8987``).
    ``host_header`` sets the ``Host:`` header — needed when connecting to a
    reverse proxy by address, where the proxy routes on the hostname and a
    request for ``localhost`` would land on the default site. Mirrors the
    ``--host-header`` flag other JamRTC tooling in this workspace already uses.
    """
    from urllib.parse import quote

    scheme = "wss" if secure else "ws"
    query = f"?room={quote(room, safe='')}&peer={quote(peer, safe='')}"
    if host_header:
        # websockets' subprotocol argument slot is not for this; the header is
        # passed per-connection. Encoded here so callers keep one entry point.
        query += f"&host_header={quote(host_header, safe='')}"
    return f"{scheme}://{host}{path}{query}"


def parse_signaling_url(url: str) -> tuple[str, dict]:
    """Split a signaling URL into ``(clean_url, extra_headers)``.

    ``host_header`` is a library-level convention, not a hub parameter, so it is
    stripped from the URL and returned as a header mapping for ``websockets``.
    """
    from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

    parts = urlsplit(url)
    params = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "host_header"]
    headers = {}
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "host_header":
            headers["Host"] = value
    # quote_via=quote keeps spaces as %20 — urlencode's default "+" is only
    # decoded by an HTML form reader, so a room named "my room" would reach the
    # hub with a literal plus in it.
    clean = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(params, quote_via=quote, safe=""), parts.fragment)
    )
    return clean, headers


# --- MIDI helpers ------------------------------------------------------------

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def describe_midi(midi: bytes) -> str:
    """One-line human description of a MIDI message, for logs and callbacks."""
    if not midi:
        return "<empty>"
    status = midi[0]
    kind = status & 0xF0
    channel = (status & 0x0F) + 1

    if kind == 0x90 and len(midi) >= 3:
        if midi[2] == 0:
            return f"note-off  ch{channel} {note_name(midi[1])}"
        return f"note-on   ch{channel} {note_name(midi[1])} vel{midi[2]}"
    if kind == 0x80 and len(midi) >= 3:
        return f"note-off  ch{channel} {note_name(midi[1])} vel{midi[2]}"
    if kind == 0xB0 and len(midi) >= 3:
        return f"cc        ch{channel} #{midi[1]}={midi[2]}"
    if kind == 0xC0 and len(midi) >= 2:
        return f"program   ch{channel} {midi[1]}"
    if kind == 0xE0 and len(midi) >= 3:
        bend = ((midi[2] << 7) | midi[1]) - 8192
        return f"pitch     ch{channel} {bend:+d}"
    if status == 0xF0:
        return f"sysex     {len(midi)} bytes"
    return "midi      " + " ".join(f"{b:02x}" for b in midi)


def note_name(note: int) -> str:
    """MIDI note number as ``C4``."""
    return f"{NOTE_NAMES[note % 12]}{note // 12 - 1}"
