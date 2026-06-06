# JamRTC — Development Progress Log

This file is maintained by Claude to preserve context across conversation sessions.
When starting a new chat: `git pull && cat PROGRESS.md`

---

## Stack

- **Frontend:** plain ES6 modules, no bundler — `src/*.js`, `index.html`
- **Backend:** Go signaler (`signaler/`) on port 8987, stream queuer on 8765
- **Deploy:** `/var/www/html/jamrtc` (Apache reverse proxy), VPS `vps514.loveprodvds.net`
- **Repo:** `denizsincar29/web_midi_streamer` (renamed from web_midi_streamer → JamRTC)
- **Service worker cache:** currently `jamrtc-v2.0.11`

## Key architectural facts

- `send(obj)` and `sendTo(id, obj)` in `webrtc.js` — accept **objects OR strings**, stringify only objects. Do NOT pre-stringify before passing.
- `hello` messages are sent by `onPeerConnect` (DC open) on both sides. On first `hello` receipt, the receiver replies once (`isNew` guard) to ensure symmetric nick exchange.
- `playStatusChime(type)` in `midi.js` — silently no-ops for missing keys AND for `{type:"silent"}` entries.
- Rooms listbox (`#roomsList`) + datalist (`#roomSuggestions`) live **inside** the Connection `<section>`, not a separate section. The old `.available-rooms` section is gone.
- `_scheduleReconnect` uses `_reconnectPending` flag to prevent doubled calls from concurrent `ws.onclose` + Promise reject.

## Chime keys (all known, as of June 2026)

| key | default | notes |
|-----|---------|-------|
| `startup` | C5 E5 G5 C6 | only plays when no auto-join URL param |
| `info` | — | via `ui.addMessage` type |
| `success` | — | via `ui.addMessage` type |
| `warning` | — | via `ui.addMessage` type |
| `error` | — | via `ui.addMessage` type |
| `connecting` | — | via `ui.addMessage` type |
| `room_connection` | — | on joining a room |
| `peer_connection` | Ab6 Db6 F6 Db7 | on peer DC open |
| `peer_disconnection` | Db7 F6 Db6 Ab6 | on peer DC close |

`chimes.json` in deploy dir overrides all defaults. Use `python3 scripts/chimes_manager.py` to manage.

## Recent fixes (this session, all pushed)

### `fix: participants list and chat nicknames` (024233b)
- Root cause: `send()`/`sendTo()` were double-`JSON.stringify`-ing pre-stringified strings → `hello` arrived as unparseable garbage → peers never appeared in participant list, chat showed generic "Partner"
- Fixed `send()` and `sendTo()` to pass strings as-is
- `hello` reply on first receipt (isNew guard)
- `addChatMessage(msg, sender, nickname)` — new nickname param
- `ParticipantsManager.get(peerId)` added

### `fix: bump cache to v2.0.11, fix chime fallback` (f6bc92d)
- `playStatusChime`: missing key → silent (no fallback to 'info')
- Service worker bumped

### `feat: implement MIDI file playback for chimes (type: midi)` (c984aa4)
- Full SMF type-0/1 parser in `midi.js._parseSMF()`
- `chimes.json` usage: `{ "type": "midi", "file": "./chimes/logo.mid" }`

### `refactor: reuse MIDIRecorder.playback for MIDI file chimes` (4574166)
- `_playMidiFile` delegates scheduling to `MIDIRecorder.playback()`
- `_parseSMF` output changed to `{deltaMs, data}` matching recorder format

### `fix: connection status and disconnect chime` (f623098)
- Last peer leaves → "waiting for peer" not "disconnected"
- `peer_connection` chime moved to `onPeerConnect` (not `onConnectionStateChange`)
- `peer_disconnection` chime on `onPeerDisconnect`
- `_removePeer` log type: warning → info (was triggering warning chime)
- `peer_disconnection` default chime added

### `feat: add scripts/chimes_manager.py` (3bae08b)
- Interactive CLI: fill missing, edit, silence, copy from example
- Deploy dir from CLI arg or default `/var/www/html/jamrtc`
- Atomic save

### `feat: room list + nick flow overhaul, fix signaling reconnect spam` (504bb24)
- `_scheduleReconnect`: `_reconnectPending` flag → no more 7× spam
- `_wsOpen`: `settled` flag, console logging, clear pending on open
- "сервер сигнализации" → "сервер комнат" / "Нет связи с сервером"
- Rooms merged into Connection section (datalist + listbox)
- Nick-first flow: click room → if no nick → focus nick field, don't connect yet
- Connect button: "Join Room" / "Create & Join" depending on whether room exists
- `startup` chime: only when no auto-join URL param
- `type: "silent"` fully supported in chimes_manager.py and midi.js

## Known open items / TODOs

- [ ] Signaling reconnect spam fixed in JS, but **root cause may be server-side** — if Caddy/signaler drops WS immediately, investigate Caddyfile + signaler Go code
- [ ] `refreshRoomsBtn` removed from HTML but `getElementById('refreshRoomsBtn')` listener still in `app.js` line 335-336 — harmless (element not found = no-op) but should be cleaned up
- [ ] `connection.roomDescription` i18n key ("Both peers must enter...") no longer shown in HTML — can be removed from i18n.js
- [ ] Consider adding `type: "silent"` entries to `chimes.example.json` as documentation

## How to deploy

```bash
# On VPS
cd /var/www/html/jamrtc
git pull
# (no build step — static files served directly)
```

> **Rule:** bump `CACHE_NAME` in `service-worker.js` in every commit that touches JS/HTML/CSS.
> Current version: `jamrtc-v2.0.12`

## How to run chimes manager

```bash
python3 scripts/chimes_manager.py          # default /var/www/html/jamrtc
python3 scripts/chimes_manager.py /path    # custom deploy dir
```

---

## Audit & fix pass (June 2026)

### Bugs found and fixed

**`fix: double-stringify in nickname broadcast (app.js)`**
- `send(JSON.stringify({type:'hello',...}))` — pre-stringifying before `send()` caused the hello to arrive as a raw string; `_handleData` parsed it to a string (not object), so `msg.type` was undefined → message silently dropped. Peer's nickname never updated after the user edited it while connected.
- Fixed: removed `JSON.stringify` wrapper.

**`fix: i18n — participants.nicknameRequired missing from EN and RU`**
- Used in two places in app.js; was guarded with `|| 'fallback'` so the missing key didn't crash but the fallback text wasn't translated.
- Added to both EN and RU.

**`fix: i18n — midi.monitor, midi.noMidiApi, synth.* keys missing from RU`**
- Both keys are in `data-i18n` attributes in index.html but only defined in EN.
- Added full RU translations for all 8 missing synth/monitor keys.

**`fix: NVDA addon — time.sleep() on main thread`**
- `_announce()` called `time.sleep(SPEECH_DELAY)` which, when invoked via `wx.CallAfter`, ran on NVDA's main thread → froze NVDA UI for 500 ms on every room change.
- Fixed: replaced with `wx.CallLater(500, ui.message, message)`.

**`feat: NVDA addon — default keyboard shortcuts`**
- `script_openJamRTC` → `NVDA+Shift+M` (open JamRTC in browser)
- `script_joinLastRoom` → `NVDA+Shift+R` (join last announced room)
- Both shortcuts can be rebound in NVDA's Input Gestures dialog.

**`chore: removed dead refreshRoomsBtn listener (app.js)`**
- Element no longer exists in HTML; the guarded no-op was cleaned up.

### Validation
- All `src/*.js` syntax-valid: acorn --ecma2022 --module ✅
- `service-worker.js` syntax-valid: acorn --ecma2022 ✅
- All `*.py` files: `python3 -m py_compile` ✅
- NVDA addon: builds to valid `.nvda-addon` zip ✅
- EN/RU i18n key parity: ✅ (after fixes)

### Current SW cache version
`jamrtc-v2.0.15`
