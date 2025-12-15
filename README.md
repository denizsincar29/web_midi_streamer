# Web MIDI Streamer

A real-time WebRTC-based MIDI streaming application that allows two users to stream MIDI data between their devices.

## Features

- **Real-time MIDI streaming** over WebRTC data channels
- **Room-based connections** - create or join rooms via URL parameter
- **SysEx support** - optional support for System Exclusive messages
- **Timestamp synchronization** - experimental feature for better timing on slow connections
- **Accessibility** - ARIA live regions and audio feedback for MIDI events
- **Keyboard navigation** - fully accessible via keyboard
- **Multiple MIDI devices** - support for various MIDI input and output devices

## Requirements

- Python 3.8+ with UV package manager
- Modern web browser with Web MIDI API support (Chrome, Edge, Opera)
- MIDI devices (e.g., Nord keyboards) connected to your computer

## Installation

1. Install UV package manager (if not already installed):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Install dependencies:
```bash
uv pip install -e .
```

## Usage

1. Start the server:
```bash
python server.py
```

The server will start on `http://localhost:8000`

2. Open the application in two browser windows/tabs:
   - User 1: `http://localhost:8000/?room=myroom`
   - User 2: `http://localhost:8000/?room=myroom`

3. In each browser:
   - Grant MIDI access when prompted
   - Select your MIDI input device (your keyboard)
   - Select your MIDI output device (for hearing the other user)
   - Click "Connect to Room"

4. Once both users are connected, play your MIDI keyboards and you'll hear each other in real-time!

## Settings

- **Enable SysEx Support**: Allow System Exclusive messages (required for advanced keyboard features)
- **Enable Timestamp Sync**: Experimental feature that sends MIDI data with timestamps for better timing on slow connections
- **Enable Audio Feedback**: Accessibility feature that announces MIDI events (e.g., "C5 on", "C5 off")

## Architecture

The application consists of:

1. **Frontend** (`index.html`, `app.js`, `style.css`):
   - Web MIDI API integration for device access
   - WebRTC peer connection management
   - User interface and controls

2. **Backend** (`server.py`):
   - FastAPI-based WebSocket signaling server
   - Room management (max 2 peers per room)
   - Message forwarding between peers

## How It Works

1. Both users connect to the signaling server via WebSocket
2. The signaling server coordinates WebRTC offer/answer exchange
3. A direct peer-to-peer WebRTC data channel is established
4. MIDI data flows directly between peers over the data channel
5. Each peer plays received MIDI data to their selected output device

## Accessibility Features

- **ARIA live regions** for status messages
- **Audio announcements** of MIDI events (note on/off, control changes)
- **Keyboard navigation** for all controls
- **Concise language** for common messages

## Development

The code is modular and well-structured:

- `MIDIStreamer` class handles all application logic
- Clear separation between MIDI handling, WebRTC, and UI
- Comprehensive error handling and user feedback

## Troubleshooting

- **MIDI access denied**: Make sure you're using a supported browser and have MIDI devices connected
- **Room is full**: Only 2 peers can connect to the same room. Use a different room name
- **No audio**: Check your MIDI output device selection and ensure it's connected to speakers/headphones
- **WebRTC connection fails**: This usually indicates network/firewall issues. The app uses STUN servers to help with NAT traversal

## License

This project is open source and available under the MIT License.
