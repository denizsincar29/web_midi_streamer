# Web MIDI Streamer

A real-time WebRTC-based MIDI streaming application that allows two users to stream MIDI data between their devices using **PeerJS** for backendless deployment.

## 🚀 Deployment Options

### Static Deployment (Recommended - No Backend Required!)

The application now uses **PeerJS** for WebRTC signaling, which means **no backend server is required**! You can deploy the static files anywhere:

#### GitHub Pages (Free & Easy)
1. Push the files to a GitHub repository
2. Go to Settings → Pages
3. Select branch and folder
4. Your app will be live at `https://yourusername.github.io/web_midi_streamer/`

#### Netlify, Vercel, Cloudflare Pages
Simply connect your repository and deploy - these services automatically detect and deploy static sites for free.

#### Local Static Server
```bash
# Serve files locally with any HTTP server
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080/?room=myroom`

### Legacy Backend Deployment (Optional)

If you prefer to use the original Python backend for signaling (instead of PeerJS cloud), see [Legacy Backend Setup](#legacy-backend-setup) below.

## Features

- **Real-time MIDI streaming** over WebRTC data channels
- **Backendless deployment** using PeerJS cloud signaling (free)
- **Room-based connections** - create or join rooms via URL parameter
- **URL sharing** - share a URL with peer ID for easy connection
- **SysEx support** - optional support for System Exclusive messages
- **Timestamp synchronization** - experimental feature for better timing on slow connections
- **Accessibility** - ARIA live regions and audio feedback for MIDI events
- **Keyboard navigation** - fully accessible via keyboard
- **Multiple MIDI devices** - support for various MIDI input and output devices

## Requirements

- Modern web browser with Web MIDI API support (Chrome, Edge, Opera)
- MIDI devices (e.g., Nord keyboards) connected to your computer
- Internet connection (for PeerJS cloud signaling)

## Quick Start

1. **Deploy the app** (choose one):
   - Upload `index.html`, `app.js`, `peerjs.min.js` (included), and `style.css` to any static hosting service
   - Or run locally: `python3 -m http.server 8080`

2. **User 1**: Open the app:
   ```
   https://your-domain.com/
   ```
   - Click "Connect to Room"
   - Copy the shareable URL that appears (e.g., `https://your-domain.com/?peer=midi-123456-abc`)

3. **User 2**: Open the shareable URL from User 1
   - The app will automatically connect - **no button click needed!**
   - Wait for "Data channel open" message

4. **Configure MIDI**:
   - Grant MIDI access when prompted
   - Select your MIDI input device (your keyboard)
   - Select your MIDI output device (for hearing the other user)

5. **Play!** - MIDI data streams directly between peers in real-time

## How It Works

```
┌─────────┐                    ┌──────────────────┐                    ┌─────────┐
│ User 1  │ ◄──── signaling ──►│ PeerJS Cloud     │◄──── signaling ────►│ User 2  │
│ Browser │                    │ (free service)   │                    │ Browser │
└─────────┘                    └──────────────────┘                    └─────────┘
     │                                                                       │
     └──────────────────── Direct P2P MIDI Data ────────────────────────────┘
                          (WebRTC Data Channel)
```

1. Users connect to PeerJS cloud signaling server
2. Peer IDs are shared via URL
3. PeerJS handles all WebRTC negotiation automatically
4. MIDI data flows directly peer-to-peer (bypasses PeerJS server)

## Network Connectivity & TURN Servers

The app includes **TURN servers** for global connectivity:

- ✅ **Works globally** - connects across different networks and the internet
- ✅ **No setup required** - free public TURN servers included
- ✅ **Automatic fallback** - tries direct P2P first, then TURN relay if needed

### Connection Types

1. **Direct P2P** (best) - Low latency, works on same network or friendly NAT
2. **TURN relay** (fallback) - Higher latency, works globally even with strict firewalls

### Testing TURN Connectivity

To verify TURN relay is working (useful when P2P connects fine):

1. Add `?forceTurn=true` to your URL to force TURN relay mode:
   ```
   https://your-domain.com/?forceTurn=true
   ```
2. The app will display "TURN RELAY MODE" message
3. Connection will only work through TURN server (no direct P2P)
4. Console will show which connection type is used (relay/host/srflx)

### For Production Use

The app uses free public TURN servers by default. For production deployments or better performance:

- **Set up your own TURN server** - See [TURN_SETUP.md](TURN_SETUP.md) for instructions
- **Use commercial TURN service** - Twilio, Xirsys, or Metered

The included free TURN servers should work fine for personal use and testing.

## Legacy Backend Setup

<details>
<summary>Click to expand instructions for using the original Python backend instead of PeerJS</summary>

### Requirements

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

   **Important**: The application automatically detects its base path from the URL. You can deploy it at:
   - Root path: `https://yourdomain.com/` (use Example 1 in apache-proxy.conf)
   - Subdirectory: `https://yourdomain.com/midi/` (use Example 2 in apache-proxy.conf)
   
   Make sure the WebSocket proxy path matches: `<base_path>/ws/`

3. Restart Apache:
```bash
sudo systemctl restart apache2
```

The application will then be accessible through your Apache server while the Python backend runs on port 8000.

</details>

## Settings

- **Enable SysEx Support**: Allow System Exclusive messages (required for advanced keyboard features)
- **Enable Timestamp Sync**: Experimental feature that sends MIDI data with timestamps for better timing on slow connections
- **Enable Audio Feedback**: Accessibility feature that announces MIDI events (e.g., "C5 on", "C5 off")
- **Show MIDI Activity**: Display MIDI events in real-time (accessibility feature)

## Architecture

### Current Architecture (Backendless with PeerJS)

The application consists of:

1. **Frontend** (`index.html`, `app.js`, `style.css`):
   - Web MIDI API integration for device access
   - PeerJS integration for WebRTC signaling
   - WebRTC peer-to-peer data channels for MIDI streaming
   - User interface and controls

2. **Signaling** (PeerJS Cloud):
   - Free hosted signaling service
   - Handles WebRTC negotiation (offers, answers, ICE candidates)
   - Does NOT see or handle MIDI data

### Legacy Architecture (Optional Python Backend)

If using the legacy backend (see instructions above):

1. **Frontend**: Same as above
2. **Backend** (`server.py`):
   - FastAPI-based WebSocket signaling server
   - Room management (max 2 peers per room)
   - Message forwarding between peers

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

### Backendless Deployment (PeerJS)

- **"Peer is not defined" error**: The PeerJS library failed to load from CDN. Check your internet connection or ad blocker settings.
- **"Peer unavailable" error**: The other user needs to connect first and share their peer ID URL with you.
- **Connection takes a long time**: This is normal - WebRTC negotiation can take 5-10 seconds. Wait for the "Data channel open" message.

### General Issues

- **MIDI access denied**: Make sure you're using a supported browser (Chrome, Edge, Opera) and have MIDI devices connected
- **No audio**: Check your MIDI output device selection and ensure it's connected to speakers/headphones
- **WebRTC connection fails**: This usually indicates network/firewall issues. The app uses STUN servers to help with NAT traversal
- **Peer disconnects immediately**: Both users must keep their browser tabs open. Closing the tab disconnects the peer.

## License

This project is open source and available under the MIT License.
