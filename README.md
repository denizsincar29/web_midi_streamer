# JamRTC

**Real-time MIDI streaming over WebRTC** — two pianists stream MIDI to each other
peer-to-peer with ultra-low latency. Rooms shareable by URL, built-in chat,
browser synth, recorder, chimes, and full screen-reader support (NVDA addon).

## Features

- 🎹 **Real-time MIDI streaming** — low-latency P2P MIDI over WebRTC data channels
  (compact binary frames, optional high-res timestamps for latency estimation)
- 🔗 **Room-based connections** — easy setup with shareable URLs
- 💬 **Built-in chat** — text over the same WebRTC connection
- 🌍 **Multi-language** — English and Russian interface
- 🎵 **SysEx support** — professional keyboard features
- 🔧 **Debug tools** — ping, stability test, message export
- 📱 **PWA ready** — installable, offline-capable
- ♿ **Accessible** — full keyboard navigation and screen reader support
- 🎛️ **MIDI Mini Apps** — Nord Effects Controller (BETA), Chord Display, iRealPro Maker

## Quick Start

### For users

1. Connect your MIDI keyboard to the computer **before** opening the page.
2. Open the app, select your MIDI input/output devices.
3. Enter a room name and click **Join Room**.
4. Share the resulting URL with your partner.
5. Start playing! 🎶

### For developers

```bash
git clone https://github.com/denizsincar29/web_midi_streamer.git
cd web_midi_streamer

# 1. Build and run the Go signaling server (WebSocket relay)
cd signaler && go build -o signaler . && ./signaler -addr :8987
cd ..

# 2. Serve the static frontend
python3 -m http.server 8080

# Open http://localhost:8080
```

## Requirements

- Modern browser with Web MIDI API support (Chrome/Edge/Opera recommended, Firefox works)
- MIDI keyboard / controller
- Go toolchain (to build the signaler) — or use a deployed instance
- Internet connection between players

## Architecture

```
┌─────────┐    WebRTC P2P (MIDI, chat, control)    ┌─────────┐
│ User 1  │◄──────────────────────────────────────►│ User 2  │
└────┬────┘                                        └────┬────┘
     │          WebSocket signaling (join/SDP/ICE)      │
     └─────────────────────┐  ┌─────────────────────────┘
                      ┌────┴──┴────┐
                      │  signaler  │  Go WebSocket relay (:8987)
                      └────────────┘
```

- **Frontend**: plain ES6 modules, no bundler — `src/*.js`, `index.html`
- **Signaling**: Go server in `signaler/` — relays `join`/`sdp`/`ice` between peers in a room
- **Data transfer**: direct P2P via WebRTC data channels (mesh)
- **NAT traversal**: free public STUN servers by default (see `DEFAULT_ICE_SERVERS` in `src/webrtc.js`)

### Protocol

- **Binary MIDI frames** (low latency): `[version][flags][Float64 timestamp?][MIDI bytes]`.
  Produced by `midi-worker.js`, decoded in `webrtc.js` (`_handleBinaryPacket`).
- **JSON control messages** over the data channel: `hello`, `chat`, `settings_sync`,
  `role_change`, `test_note`, `midi`, `ping`/`pong`, `stab_probe`/`stab_result`.
  Every message carries an explicit `type`; unknown types are dropped, never misread as MIDI.
- **WebSocket signaling**: `join`, `sdp`, `ice`, `keepalive` (keepalive is swallowed
  by the server and never relayed).

## Key files

- `index.html` — main application page
- `src/main.js` — application orchestration, service-worker update handling
- `src/app.js` — main MIDIStreamer class (MIDI routing, chat, participants, recorder)
- `src/webrtc.js` — WebRTC connection management (perfect negotiation, binary decode)
- `src/midi-worker.js` — off-main-thread binary MIDI framing
- `src/config.js` — shared constants (`APP_VERSION`, `MIDI_FRAME_VERSION`)
- `src/midi.js` — MIDI device handling, chimes, SMF playback
- `src/i18n.js` — English/Russian translations
- `signaler/` — Go WebSocket signaling server
- `service-worker.js` — PWA offline support

## Deployment

**VPS** (e.g. `vps514.loveprodvds.net`): static files served by Apache reverse
proxy at `/var/www/html/jamrtc`, Go signaler proxied on the `/signal` WebSocket
path. The static deploy is a plain `git pull` — no build step.

Local static deploy helper: `./rebuild.sh [target-dir]`.

### Versioning

Cache version and app version must stay in sync:

```bash
python3 scripts/bump.py 2.0.23   # bump both service-worker.js + src/config.js
python3 scripts/bump.py --check  # verify they match
npm test                          # syntax-check all JS modules
```

Rule: **every commit that touches JS/HTML/CSS must bump the cache version**
(`scripts/bump.py`), otherwise the service worker won't reload and players see a
stale-client warning.

## TURN

Free public STUN servers work for most connections. If a direct P2P path can't
be established (restrictive/symmetric NAT), add a TURN server to
`DEFAULT_ICE_SERVERS` in `src/webrtc.js` — see [TURN_SETUP.md](TURN_SETUP.md).

## Troubleshooting

- **Takes long to connect**: WebRTC negotiation can take 5–10 s; retries renegotiate.
- **Cannot connect**: both players must use the same room URL and reach the signaler.
- **Stale-client warning**: someone is on an older cache version — hard-refresh
  (`Ctrl+Shift+R` / `Cmd+Shift+R`) or reload to pick up the latest build.
- **MIDI access denied**: connect the device before opening the page.

## License

ISC. Made with ❤️ for musicians and MIDI enthusiasts.
