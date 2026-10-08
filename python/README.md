# jamrtc — Python MIDI peer for JamRTC rooms

A Python client for [JamRTC](https://github.com/denizsincar29/web_midi_streamer),
the browser MIDI jam app. Players meet in a named room, the Go signaler
introduces them, and notes travel **directly peer-to-peer over WebRTC data
channels**. This package puts a Python process on that same wire: join a room,
play, listen, relay notes between peers, and expose the whole thing as ordinary
[`mido`](https://mido.readthedocs.io/) ports.

It speaks the exact protocol the browser app speaks — the same MIDI frame
format, the same signaling JSON, the same politeness rule — so a Python peer is
indistinguishable from another browser in the room.

## Install

```bash
pip install --user -e .
```

For real MIDI hardware or virtual ports (needed by `JamRTCInput` /
`JamRTCOutput` / `JamRTCIo`):

```bash
pip install --user -e ".[ports]"
```

`aiortc` builds a small native extension on first install; on a machine without
a C toolchain use a prebuilt wheel (`pip install --user aiortc` normally
resolves one).

## Three layers

| Layer | What it is |
| --- | --- |
| `jamrtc.protocol` | The wire format — MIDI frames and signaling JSON |
| `jamrtc.Peer` | One participant on one socket: send, receive, relay MIDI |
| `jamrtc.RoomObserver` | An anonymous listener that answers players' offers |
| `JamRTCInput` / `JamRTCOutput` / `JamRTCIo` | `mido` ports over the peer |

## Joining a room

```python
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
```

`wait_connected()` returns once at least one other peer has an open data
channel — after that `send_midi` reaches the room. `peer.links` maps remote id
to a `PeerLink`, and `peer.send_to(remote_id, ...)` targets one of them.

## As `mido` ports

`JamRTCOutput` is a `mido` output that plays into the room; `JamRTCInput` is a
`mido` input that yields whatever the room plays; `JamRTCIo` is both, and relays
between the room and a local port.

```python
import mido, jamrtc

with jamrtc.JamRTCOutput("studio", "jamrtc.denizsincar.ru", nickname="deniz") as out:
    out.send(mido.Message("note_on", note=60, velocity=100))
    out.send(mido.Message("note_off", note=60, velocity=0))
```

```python
with jamrtc.JamRTCIo("studio", "jamrtc.denizsincar.ru") as io:
    with mido.open_input("IAC Driver Bus 1") as local_in:
        for msg in local_in:      # everything you play locally goes to the room
            io.send(msg)
    for msg in io:                # everything the room plays comes back
        print(msg)
```

The `open_input` / `open_output` / `open_ioport` helpers return
`mido`-compatible ports configured against a room, mirroring `mido`'s own
factory names.

## Listening anonymously

`RoomObserver` joins a room without taking part in it: it announces nothing,
holds no nickname, and is never shown to the players as a participant. It works
because of the politeness rule in the browser app (`_isPolite`: the peer with
the **smaller** id makes the offer, the larger one answers); the observer's id
is prefixed so that it is always the larger side, so it silently answers every
player's offer and receives their notes.

```python
import asyncio, jamrtc

async def main():
    obs = jamrtc.RoomObserver("studio", host="jamrtc.denizsincar.ru")
    obs.on_midi = lambda midi, who: print(who[:8], jamrtc.describe_midi(midi))
    await obs.connect()
    await asyncio.sleep(30)
    await obs.close()

asyncio.run(main())
```

Or with the context manager, which also hides the room in the public listing
while you are in it:

```python
with jamrtc.observe("studio", host="jamrtc.denizsincar.ru") as obs:
    for midi, who in obs.iter_midi(timeout=5.0):
        print(who[:8], jamrtc.describe_midi(midi))
```

This is for listening to your own rooms. Be aware that it is passive
monitoring — if you run it against a room others use, they can see an
anonymous connection appears in their client once it answers an offer.

## Relaying

`obs.relay(midi, from_peer)` re-sends a note to every other peer in the room
instead of only reporting it, with the original timestamp preserved so timing
survives the extra hop. `obs.relay_loop()` wires that up as the default `on_midi`
handler. This turns the Python peer into a bridge — for example, a room that
reaches a machine with real MIDI gear, or a repeater between two rooms.

The same works from `Peer`: iterate `peer.links` and call `link.channel.send(
jamrtc.encode_midi_frame(midi))` for every link that is not the sender.

## Command line

```bash
python -m jamrtc listen studio --host jamrtc.denizsincar.ru
python -m jamrtc listen studio --host jamrtc.denizsincar.ru --anonymous
python -m jamrtc listen studio --host jamrtc.denizsincar.ru --anonymous --relay
python -m jamrtc send   studio --host jamrtc.denizsincar.ru --note 60 --note 64
python -m jamrtc bridge studio --host jamrtc.denizsincar.ru --port "IAC Driver"
python -m jamrtc rooms  --host jamrtc.denizsincar.ru
```

`listen --json` prints one machine-readable line per note. `bridge` falls back
to plain printing if the local MIDI port is unavailable, so it doubles as a
room check on a box with no MIDI stack at all.

## Protocol notes

Messages on the data channel are either a **binary MIDI frame** or a **JSON
string**. The frame is little-endian:

```
byte 0        version (currently 2)
byte 1        flags — bit 0 means "a timestamp follows"
bytes 2..9    float64 milliseconds (only when the flag is set)
bytes 10..    raw MIDI bytes, e.g. 90 3C 64
```

Frames from builds before version 2 begin with a literal `0x00`/`0x01` flag
byte instead of a version; `decode_midi_frame` handles both.

JSON messages carry a `type` that must be in `KNOWN_APP_TYPES`
(`chat`, `hello`, `settings_sync`, `role_change`, `test_note`, `ping`, `pong`,
`stab_probe`, `stab_result`); anything else binary is treated as MIDI. Unknown
JSON types are ignored rather than fatal, so a newer browser build will not
break an older Python peer.

## Limits

- Uses the public JamRTC deployment by default; pass `host=` to point at your own.
- `secure=False` switches `wss://` to `ws://` for local development.
- Anonymous listening depends on the politeness rule in the browser app: the
  observer sees players who connect *after* it, and it never appears in their
  participant list.
- `MAX_MESSAGE_BYTES` caps a single frame at 1 KiB; SysEx larger than that is
  dropped rather than split.

## Tests

```bash
python -m pytest tests -q
```

Tested against the live deployment at `jamrtc.denizsincar.ru`.
