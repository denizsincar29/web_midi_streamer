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
pip install uv
```

2. The dependencies will be automatically installed when you run the server using `uv run`.

## Configuration

The server can be configured using environment variables. Create a `.env` file in the project root:

```bash
# Copy the example configuration
cp .env.example .env
```

Available configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Server host address | `0.0.0.0` |
| `PORT` | Server port | `8000` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL) | `INFO` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated or `*` for all) | `*` |

Example `.env`:
```env
HOST=0.0.0.0
PORT=9000
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000,https://example.com
```

## Usage

### Quick Start

Start the server using UV (recommended):
```bash
uv run server.py
```

Or using Python directly:
```bash
python server.py
```

The server will start on `http://localhost:8000` by default (or the port specified in your `.env` file).

### Connecting Users

1. Open the application in two browser windows/tabs:
   - User 1: `http://localhost:8000/?room=myroom`
   - User 2: `http://localhost:8000/?room=myroom`

2. In each browser:
   - Grant MIDI access when prompted
   - Select your MIDI input device (your keyboard)
   - Select your MIDI output device (for hearing the other user)
   - Click "Connect to Room"

3. Once both users are connected, play your MIDI keyboards and you'll hear each other in real-time!

## Production Deployment

### Systemd Service (Linux)

For production deployment on Linux servers, use the provided setup script:

```bash
./setup-systemd.sh
```

This will create a systemd service file. Follow the instructions printed by the script to install and start the service.

The service will:
- Run as the current user
- Auto-restart on failure
- Log to system journal
- Start automatically on boot (if enabled)

To manage the service:
```bash
# Start the service
sudo systemctl start web-midi-streamer.service

# Stop the service
sudo systemctl stop web-midi-streamer.service

# View logs
sudo journalctl -u web-midi-streamer.service -f
```

### Apache Reverse Proxy

To run behind Apache, use the provided configuration:

1. Enable required Apache modules:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

2. Add the content from `apache-proxy.conf` to your Apache virtual host configuration

3. Restart Apache:
```bash
sudo systemctl restart apache2
```

The application will then be accessible through your Apache server while the Python backend runs on port 8000.

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
