# Web MIDI Streamer

A real-time WebRTC-based MIDI streaming application that allows two users to stream MIDI data between their devices using HTTP polling-based signaling.

## 🚀 Quick Start

### Local Development
```bash
# Serve the application locally
php -S localhost:8080
# or use Python
python3 -m http.server 8080
```

Then open `http://localhost:8080/`

### Deployment
The application requires a PHP backend for signaling. Deploy to any hosting service that supports PHP:
- Traditional shared hosting (cPanel, etc.)
- VPS or cloud servers
- Platform-as-a-Service (Heroku, etc.)

## Features

- **Real-time MIDI streaming** over WebRTC data channels
- **HTTP polling signaling** - Simple PHP-based signaling server
- **Room-based connections** - create or join rooms via URL parameter
- **URL sharing** - share a URL with peer ID for easy connection
- **SysEx support** - optional support for System Exclusive messages
- **Timestamp synchronization** - experimental feature for better timing on slow connections
- **MIDI chimes** - customizable audio feedback for connection events
- **Accessibility** - ARIA live regions and audio feedback for MIDI events
- **Keyboard navigation** - fully accessible via keyboard
- **Multiple MIDI devices** - support for various MIDI input and output devices

## Requirements

- Modern web browser with Web MIDI API support (Chrome, Edge, Opera)
- MIDI devices (e.g., Nord keyboards) connected to your computer
- PHP-enabled web server for signaling
- Internet connection

## Quick Start

1. **Deploy the app** (choose one):
   - Upload all files to any static hosting service (GitHub Pages, Netlify, Vercel, etc.)
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
│ User 1  │ ◄──── signaling ──►│ signaling.php    │◄──── signaling ────►│ User 2  │
│ Browser │                    │ (HTTP polling)   │                    │ Browser │
└─────────┘                    └──────────────────┘                    └─────────┘
     │                                                                       │
     └──────────────────── Direct P2P MIDI Data ────────────────────────────┘
                          (WebRTC Data Channel)
```

1. Users connect to signaling server via HTTP polling
2. Peer IDs are shared via URL
3. Signaling server handles WebRTC offer/answer exchange
4. MIDI data flows directly peer-to-peer (bypasses signaling server)

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

The app uses a default STUN server. For production deployments or better connectivity across strict firewalls:

- **Set up your own TURN server** - See [TURN_SETUP.md](TURN_SETUP.md) for instructions
- **Use commercial TURN service** - Twilio, Xirsys, or Metered

### Testing TURN Connectivity

To test that TURN relay is working correctly, force the app to use only TURN relay:

1. Add `?forceTurn=true` to the URL: `https://your-domain.com/?forceTurn=true`
2. The app will display "TURN relay mode" message
3. Check the browser console for "relay" type ICE candidates

## Settings

### Basic Settings
- **Enable SysEx Support**: Allow System Exclusive messages (required for advanced keyboard features)
- **Enable Timestamp Sync**: Experimental feature that sends MIDI data with timestamps for better timing on slow connections
- **Enable Audio Feedback**: Accessibility feature that announces MIDI events (e.g., "C5 on", "C5 off")
- **Show MIDI Activity**: Display MIDI events in real-time (accessibility feature)

### MIDI Chimes
The application supports customizable MIDI chimes for connection events. Configure chimes in `chimes.json`:

```json
{
  "success": {
    "type": "notes",
    "notes": "C5 E5 G5",
    "velocity": 100,
    "duration": 150
  },
  "error": {
    "type": "notes", 
    "notes": "E5 C5 A4 F4",
    "velocity": 120,
    "duration": 200
  }
}
```

Available chime types: `success`, `connecting`, `warning`, `error`, `info`

## Signaling Server Setup

The application uses a custom PHP-based signaling server for WebRTC negotiation:

1. **Set up signaling directory**
   ```bash
   mkdir -p signaling_data
   chmod 755 signaling_data
   ```

2. **Configure TURN server** (optional, for better connectivity)
   ```bash
   cp config.example.php config.php
   # Edit config.php with your TURN server details
   ```

3. **Start server**
   ```bash
   php -S localhost:8080
   ```

The signaling server handles:
- WebRTC offer/answer exchange
- ICE candidate relay
- Room management
- Peer discovery

For production deployment, consider using Redis instead of file storage for better performance.

## Architecture

The application is a modern single-page application (SPA) with a PHP signaling backend:

1. **Frontend** (`index.html`, `src/*.js`, `style.css`):
   - Web MIDI API integration for device access
   - Native WebRTC implementation for peer connections
   - WebRTC peer-to-peer data channels for MIDI streaming
   - User interface and controls

2. **Signaling Backend** (`signaling.php`):
   - HTTP polling-based signaling
   - WebRTC negotiation (offers, answers, ICE candidates)
   - Does NOT see or handle MIDI data

3. **TURN Credentials** (`get-turn-credentials.php`):
   - Generates time-limited TURN credentials
   - Optional, for improved connectivity

### Code Structure

The code is modular and well-organized:

- `src/main.js` - Application entry point and orchestration
- `src/webrtc.js` - WebRTC connection management with HTTP polling signaling
- `src/midi.js` - MIDI device handling and message processing
- `src/ui.js` - User interface updates and DOM manipulation
- `src/config.js` - Configuration and TURN credential management
- `src/utils.js` - Utility functions

## Accessibility Features

- **ARIA live regions** for status messages
- **Audio announcements** of MIDI events (note on/off, control changes)
- **Keyboard navigation** for all controls
- **Concise language** for common messages

## Development

The code is modular and well-structured with clear separation of concerns:

- **MIDIManager** class handles MIDI device access and messaging
- **WebRTCManager** class handles peer connections and data channels
- **UIManager** class handles user interface updates
- **Main application** orchestrates all components

### Development Server

```bash
# Serve the application locally
python3 -m http.server 8080
# Open http://localhost:8080
```

### Code Quality

- Comprehensive error handling and user feedback
- Modular ES6 modules for maintainability
- Accessibility features with ARIA support
- Clean separation between MIDI, WebRTC, and UI logic

## Troubleshooting

### Connection Issues

- **"Peer is not defined" error**: The PeerJS library failed to load. Check your internet connection or ad blocker settings.
- **"Peer unavailable" error**: The other user needs to connect first and share their peer ID URL with you.
- **Connection takes a long time**: WebRTC negotiation can take 5-10 seconds. Wait for the "Data channel open" message.
- **Connection fails entirely**: 
  - Ensure both users have internet access
  - Check browser console for specific error messages
  - Verify TURN servers are accessible (see testing section above)
  - Try the `?forceTurn=true` mode to test TURN relay

### MIDI Issues

- **MIDI access denied**: Make sure you're using a supported browser (Chrome, Edge, Opera) and have MIDI devices connected
- **No audio**: Check your MIDI output device selection and ensure it's connected to speakers/headphones
- **Devices not appearing**: Click "Refresh Devices" button or reconnect your MIDI device

### General Issues

- **Peer disconnects immediately**: Both users must keep their browser tabs open. Closing the tab disconnects the peer.
- **High latency**: This may indicate TURN relay is being used instead of direct P2P. Direct P2P has lower latency.
- **Status stuck on "Connecting"**: Reload the page and try again. Check browser console for errors.

## License

This project is open source and available under the MIT License.
