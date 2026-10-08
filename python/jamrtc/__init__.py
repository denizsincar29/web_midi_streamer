"""jamrtc — a Python MIDI peer for JamRTC rooms.

JamRTC is the browser MIDI jam app at https://github.com/denizsincar29/web_midi_streamer:
players meet in a named room, the Go signaler introduces them, and notes travel
directly peer-to-peer over WebRTC data channels. This package is a Python peer
on that same wire, so a script can join a room, play, listen, transit notes
between peers, and expose the whole thing as ordinary ``mido`` ports.

Three layers, usable independently:

    protocol   the wire format — MIDI frames and signaling JSON
    Peer       one participant on one socket, send/receive/relay MIDI
    RoomObserver
               an anonymous listener that answers players' offers
    JamRTCInput / JamRTCOutput / JamRTCIo
               ``mido`` ports over the peer

Quick start — play and listen::

    import asyncio, jamrtc

    async def main():
        peer = jamrtc.Peer(room="studio", nickname="deniz")
        peer.on_midi = lambda midi, who: print(who[:8], jamrtc.describe_midi(midi))
        await peer.connect("jamrtc.denizsincar.ru")
        await peer.wait_connected()
        await peer.send_midi([0x90, 60, 100])   # C4 on
        await peer.send_midi([0x80, 60, 0])     # C4 off
        await asyncio.sleep(2)
        await peer.close()

    asyncio.run(main())

Quick start — MIDI through ``mido``::

    import jamrtc

    with jamrtc.JamRTCOutput("studio", "jamrtc.denizsincar.ru") as out:
        out.send(mido.Message("note_on", note=60, velocity=100))

Quick start — listen in anonymously::

    obs = jamrtc.RoomObserver("studio", host="jamrtc.denizsincar.ru")
    obs.on_midi = lambda midi, who: print(who[:8], jamrtc.describe_midi(midi))
    await obs.connect()
"""

from .protocol import (
    describe_midi,
    encode_midi_frame,
    decode_midi_frame,
    note_name,
    signaling_url,
    KNOWN_APP_TYPES,
    MIDI_FRAME_VERSION,
    ROLE_OBSERVER,
    ROLE_PLAYER,
)
from .peer import Peer, PeerLink
from .observer import RoomObserver, ObserveSession, observe
from .midi_backend import (
    JamRTCInput,
    JamRTCIo,
    JamRTCOutput,
    open_input,
    open_ioport,
    open_output,
)

__version__ = "0.1.0"

__all__ = [
    "Peer",
    "PeerLink",
    "RoomObserver",
    "ObserveSession",
    "observe",
    "JamRTCInput",
    "JamRTCOutput",
    "JamRTCIo",
    "open_input",
    "open_output",
    "open_ioport",
    "encode_midi_frame",
    "decode_midi_frame",
    "describe_midi",
    "note_name",
    "signaling_url",
    "KNOWN_APP_TYPES",
    "MIDI_FRAME_VERSION",
    "ROLE_PLAYER",
    "ROLE_OBSERVER",
    "__version__",
]
