"""Command line: join a room, listen, or bridge it to local MIDI.

    python -m jamrtc listen  studio --host jamrtc.denizsincar.ru
    python -m jamrtc listen  studio --host jamrtc.denizsincar.ru --anonymous
    python -m jamrtc send    studio --host jamrtc.denizsincar.ru --note 60
    python -m jamrtc bridge  studio --host jamrtc.denizsincar.ru --port "IAC Driver"
    python -m jamrtc rooms   --host jamrtc.denizsincar.ru

``bridge`` is the relay case: everything that arrives on the room's peer
connections is written to a local MIDI port, and everything played on that port
goes out to the room. Use ``--pure-observer`` to listen without joining the
roster at all.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
import urllib.request

from . import __version__, protocol
from .observer import RoomObserver
from .peer import Peer


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("room", help="room name")
    parser.add_argument("--host", required=True, help="signaler host, e.g. jamrtc.denizsincar.ru")
    parser.add_argument("--plain", action="store_true", help="use ws:// instead of wss:// (local dev)")
    parser.add_argument("--anonymous", action="store_true", help="listen without announcing ourselves")
    parser.add_argument("--nickname", help="nickname others see (ignored when anonymous)")
    parser.add_argument("--verbose", "-v", action="store_true")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="jamrtc", description="Python MIDI peer for JamRTC rooms")
    parser.add_argument("--version", action="version", version=f"jamrtc {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    listen = sub.add_parser("listen", help="print every note played in the room")
    _add_common(listen)
    listen.add_argument("--duration", type=float, help="stop after N seconds")
    listen.add_argument("--relay", action="store_true", help="forward each note to the other peers")
    listen.add_argument("--json", action="store_true", help="print machine-readable lines")

    send = sub.add_parser("send", help="play notes into the room")
    _add_common(send)
    send.add_argument("--note", type=int, action="append", help="MIDI note, repeatable")
    send.add_argument("--velocity", type=int, default=100)
    send.add_argument("--channel", type=int, default=1, help="1-16")
    send.add_argument("--duration-ms", type=int, default=500)

    bridge = sub.add_parser("bridge", help="connect a local MIDI port to the room")
    _add_common(bridge)
    bridge.add_argument("--port", required=True, help="local MIDI port name (mido output and input)")
    bridge.add_argument("--duration", type=float)

    rooms = sub.add_parser("rooms", help="list rooms known to the signaler")
    rooms.add_argument("--host", required=True)
    rooms.add_argument("--plain", action="store_true")

    return parser


async def cmd_listen(args: argparse.Namespace) -> int:
    import jamrtc

    if args.relay and args.anonymous:
        # The observer already is the only peer that reaches everyone; relaying
        # from it is meaningful, so this combination is allowed deliberately.
        pass

    if args.anonymous:
        obs = RoomObserver(args.room, host=args.host, secure=not args.plain)
        if args.relay:
            obs.relay_loop()
        else:
            obs.on_midi = lambda midi, who: _emit(midi, who, args.json)
        await obs.connect()
        scope = obs
    else:
        peer = Peer(args.room, nickname=args.nickname or "python", host_header=None)
        peer.on_midi = (
            (lambda midi, who: peer._spawn(_relay(peer, midi, who)))
            if args.relay
            else (lambda midi, who: _emit(midi, who, args.json))
        )
        await peer.connect(args.host, secure=not args.plain)
        scope = peer

    print(f"listening in {args.room!r} as {scope.peer_id}", file=sys.stderr)
    try:
        if args.duration:
            await asyncio.sleep(args.duration)
        else:
            await asyncio.Event().wait()
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        await scope.close()
    return 0


async def _relay(peer: Peer, midi: bytes, who: str) -> None:
    for rid, link in list(peer.links.items()):
        if rid != who and link.connected:
            link.channel.send(protocol.encode_midi_frame(midi))


def _emit(midi: bytes, who: str, as_json: bool) -> None:
    if as_json:
        print(json.dumps({"peer": who, "midi": list(midi), "text": protocol.describe_midi(midi)}), flush=True)
    else:
        print(f"{who[:8]}  {protocol.describe_midi(midi)}", flush=True)


async def cmd_send(args: argparse.Namespace) -> int:
    import mido

    from .midi_backend import JamRTCOutput

    notes = args.note or [60]
    out = JamRTCOutput(
        args.room,
        args.host,
        nickname=args.nickname or "python",
        anonymous=args.anonymous,
        secure=not args.plain,
    )
    if not out.wait(20.0):
        print("no peer answered — nobody else is in the room", file=sys.stderr)
    channel = max(0, min(15, args.channel - 1))
    try:
        for note in notes:
            out.send(mido.Message("note_on", note=note, velocity=args.velocity, channel=channel))
        await asyncio.sleep(args.duration_ms / 1000.0)
        for note in notes:
            out.send(mido.Message("note_off", note=note, velocity=0, channel=channel))
        await asyncio.sleep(0.3)
    finally:
        out.close()
    return 0


async def cmd_bridge(args: argparse.Namespace) -> int:
    import mido

    from .midi_backend import JamRTCIo

    io = JamRTCIo(
        args.room,
        args.host,
        nickname=args.nickname or "python-bridge",
        anonymous=args.anonymous,
        secure=not args.plain,
    )
    # A local port is optional: without one this is a pure listener that still
    # relays nothing, which is what you want when checking a room from a box
    # that has no MIDI stack at all.
    local_out = local_in = None
    try:
        local_out = mido.open_output(args.port)
        local_in = mido.open_input(args.port)
    except Exception as exc:
        print(f"local MIDI port {args.port!r} unavailable: {exc}", file=sys.stderr)
        print("continuing as a listener without local MIDI", file=sys.stderr)

    stop = asyncio.Event()

    async def room_to_local() -> None:
        while not stop.is_set():
            msg = io.poll()
            if msg is None:
                await asyncio.sleep(0.002)
                continue
            if local_out is not None:
                local_out.send(msg)
            else:
                print(protocol.describe_midi(msg.bin()), flush=True)

    async def local_to_room() -> None:
        if local_in is None:
            return
        while not stop.is_set():
            msg = local_in.poll()
            if msg is None:
                await asyncio.sleep(0.002)
                continue
            io.send(msg)

    tasks = [asyncio.ensure_future(room_to_local()), asyncio.ensure_future(local_to_room())]
    print(f"bridging {args.room!r} ↔ {args.port!r}", file=sys.stderr)
    try:
        if args.duration:
            await asyncio.sleep(args.duration)
        else:
            await stop.wait()
    finally:
        stop.set()
        for task in tasks:
            task.cancel()
        for port in (local_in, local_out):
            if port is not None:
                port.close()
        io.close()
    return 0


def cmd_rooms(args: argparse.Namespace) -> int:
    scheme = "http" if args.plain else "https"
    url = f"{scheme}://{args.host}/rooms"
    with urllib.request.urlopen(url, timeout=10.0) as response:
        rooms = json.load(response)
    if not rooms:
        print("no rooms right now")
        return 0
    for room in rooms:
        print(f"{room['name']:24} {room.get('peerCount', 0)} peer(s)")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if getattr(args, "verbose", False) else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    if args.command == "rooms":
        return cmd_rooms(args)
    try:
        return asyncio.run(
            {
                "listen": cmd_listen,
                "send": cmd_send,
                "bridge": cmd_bridge,
            }[args.command](args)
        )
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
