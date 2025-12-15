# Migration Guide: Static Deployment with PeerJS

## Overview

This guide explains how to migrate the Web MIDI Streamer from a self-hosted Python backend to a **static deployment using PeerJS** for WebRTC signaling. This eliminates the need to run any backend server.

## Current Architecture

The current application consists of:
- **Backend**: Python FastAPI server (server.py)
  - Serves static files (HTML, CSS, JS)
  - Provides WebSocket signaling server for WebRTC
  - Manages room state and peer connections
- **Frontend**: Pure JavaScript (app.js)
  - Handles Web MIDI API
  - Manages WebRTC peer-to-peer connections
  - All MIDI data flows directly between peers (not through server)

**Key Insight**: The backend's **only critical function** is WebRTC signaling. It does NOT handle MIDI data - that flows peer-to-peer via WebRTC data channels.

## What is PeerJS?

**PeerJS** is a JavaScript library that simplifies WebRTC peer-to-peer connections by:
1. Providing a free, hosted signaling server (cloud.peerjs.com)
2. Abstracting away complex WebRTC signaling code
3. Handling ICE candidate exchange, SDP offers/answers automatically
4. Supporting data channels for binary/text transmission

### How PeerJS Works

```
┌─────────┐                    ┌──────────────────┐                    ┌─────────┐
│ Peer A  │ ◄──── signaling ──►│ PeerJS Cloud     │◄──── signaling ────►│ Peer B  │
│ Browser │                    │ (free service)   │                    │ Browser │
└─────────┘                    └──────────────────┘                    └─────────┘
     │                                                                       │
     └──────────────────── Direct P2P MIDI Data ────────────────────────────┘
                          (WebRTC Data Channel)
```

1. Each peer connects to PeerJS cloud signaling server
2. Peers exchange their unique IDs (e.g., via URL: `?room=abc123`)
3. PeerJS handles all WebRTC negotiation automatically
4. Once connected, MIDI data flows directly peer-to-peer (bypasses PeerJS server)

## Migration Benefits

### ✅ Advantages

1. **Zero Backend Maintenance**
   - No server to run, update, or monitor
   - No Python, dependencies, or system services to manage
   - No SSL certificates or domain configuration needed

2. **Free Hosting**
   - Host static files on GitHub Pages, Netlify, Vercel, or Cloudflare Pages (all free)
   - PeerJS cloud signaling server is completely free
   - No ongoing costs

3. **Infinite Scalability**
   - Static hosting can handle unlimited users viewing the page
   - PeerJS handles millions of connections globally
   - No capacity planning needed

4. **Global Performance**
   - CDN automatically distributes static files worldwide
   - PeerJS has servers around the globe for low-latency signaling
   - MIDI data still flows peer-to-peer (same performance as before)

5. **Simpler Deployment**
   - Just push files to GitHub → automatic deployment
   - No server configuration, systemd services, or port forwarding
   - Works everywhere without firewall/proxy issues

6. **Better Reliability**
   - PeerJS infrastructure is professionally maintained
   - Automatic failover and redundancy
   - Less likely to go down than self-hosted server

### ⚠️ Trade-offs

1. **Dependency on Third-Party Service**
   - Requires PeerJS cloud to be operational (has excellent uptime)
   - If PeerJS shuts down, would need to switch services or self-host

2. **Less Control Over Signaling**
   - Can't customize room limits or add authentication at signaling level
   - Must trust PeerJS privacy policy (they don't see MIDI data, only signaling)

3. **Room Management Differences**
   - Current implementation limits rooms to 2 peers - need to implement this client-side
   - No server-side room state tracking

## Implementation Guide

### Step 1: Add PeerJS Library

Add to `index.html` before closing `</body>`:

```html
<script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
```

### Step 2: Modify app.js Connection Code

Replace the WebSocket connection code with PeerJS:

```javascript
// Current: WebSocket to Python backend
async connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const wsUrl = `${protocol}//${window.location.host}${basePath}ws/${this.roomName}`;
    this.ws = new WebSocket(wsUrl);
    // ... more WebSocket code
}

// New: PeerJS for signaling
async connect() {
    // Create peer with room name as ID
    const peerId = `midi-${this.roomName}-peer-${Date.now()}`;
    
    this.peer = new Peer(peerId, {
        host: 'peerserver.com',  // Free PeerJS cloud server
        port: 443,
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    this.peer.on('open', (id) => {
        this.addMessage(`Connected to PeerJS. Your ID: ${id}`, 'success');
        this.updateConnectionStatus('Waiting for peer...');
        
        // Listen for incoming connections
        this.peer.on('connection', (conn) => {
            this.setupDataConnection(conn);
        });
        
        // Try to connect to peer (using room name as shared identifier)
        // In practice, you'd share peer IDs via URL or QR code
        const remotePeerId = this.getRemotePeerId(); // Your logic here
        if (remotePeerId) {
            const conn = this.peer.connect(remotePeerId, {
                reliable: true
            });
            this.setupDataConnection(conn);
        }
    });
    
    this.peer.on('error', (err) => {
        this.addMessage(`PeerJS error: ${err.message}`, 'error');
    });
}

setupDataConnection(conn) {
    this.dataChannel = conn;
    
    conn.on('open', () => {
        this.addMessage('Data channel open - ready to stream MIDI!', 'success');
        this.updateDebugButtonsState(true);
    });
    
    conn.on('data', (data) => {
        // Handle incoming MIDI data (same as before)
        this.handlePeerMIDIMessage(data);
    });
    
    conn.on('close', () => {
        this.addMessage('Peer disconnected', 'warning');
        this.updateDebugButtonsState(false);
    });
}

// Send MIDI data (simplified)
handleMIDIMessage(event) {
    if (this.dataChannel && this.dataChannel.open) {
        this.dataChannel.send({
            data: Array.from(event.data),
            timestamp: this.timestampEnabled ? performance.now() : undefined
        });
    }
}
```

### Step 3: Deploy Static Files

**Option A: GitHub Pages** (Easiest)
```bash
# 1. Create a new branch for GitHub Pages
git checkout -b gh-pages

# 2. Keep only static files
git rm server.py pyproject.toml uv.lock setup-systemd.sh apache-proxy.conf
git commit -m "Remove backend files for static deployment"

# 3. Push to GitHub
git push origin gh-pages

# 4. Enable GitHub Pages in repository settings
# Settings → Pages → Source: gh-pages branch
```

Your app will be live at: `https://yourusername.github.io/web_midi_streamer/`

**Option B: Netlify**
```bash
# 1. Create netlify.toml
cat > netlify.toml << EOF
[build]
  publish = "."
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOF

# 2. Deploy via Netlify CLI or drag-and-drop
netlify deploy --prod
```

**Option C: Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Step 4: Update Room Sharing

Since you no longer have server-managed rooms, peers need to share IDs:

**Option 1: URL-based sharing**
```javascript
// Peer 1: Generate and share URL
const myPeerId = peer.id;
const shareUrl = `${window.location.origin}?peer=${myPeerId}`;
// Display QR code or share button for shareUrl

// Peer 2: Connect using URL parameter
const urlParams = new URLSearchParams(window.location.search);
const remotePeerId = urlParams.get('peer');
if (remotePeerId) {
    const conn = peer.connect(remotePeerId);
}
```

**Option 2: Use PeerJS room service** (additional library)
```javascript
// Install: npm install peerjs-room
import Room from 'peerjs-room';

const room = new Room(peer, 'midi-room-' + this.roomName);
room.on('peer', (peer) => {
    // New peer joined room
});
```

## Is This a Good Idea?

### ✅ **YES - PeerJS Migration is Excellent for Most Users**

**You should migrate to PeerJS if:**
1. You want **zero maintenance** - No server to manage, update, or monitor
2. You want **free hosting** - GitHub Pages + PeerJS cloud = $0/month
3. You have **low/medium traffic** - Works great for personal/small team use
4. You want **global availability** - CDN distributes your app worldwide
5. You value **simplicity** - Git push = automatic deployment
6. You're okay with **dependency on PeerJS** - Excellent uptime, trusted service

**Real-world verdict**: For a MIDI streaming app used by individuals or small teams, PeerJS is the **perfect solution**. You eliminate all backend complexity while maintaining the exact same functionality.

### ⚠️ **MAYBE - Consider Your Requirements**

**You might want to keep Python backend if:**
1. **Privacy concerns** - You need 100% control over signaling (though PeerJS can't see MIDI data)
2. **Custom authentication** - Need server-side room access control
3. **Enterprise deployment** - Company policy requires self-hosted everything
4. **Very high traffic** - Thousands of simultaneous connections (though PeerJS scales well)
5. **Custom features** - Want to add server-side recording, logging, or moderation

### ❌ **NO - Don't Use PeerJS If:**
1. You need guaranteed 99.99% uptime SLA (self-host instead)
2. You require complete air-gapped deployment (no internet dependencies)
3. You want to add features that need a backend (user accounts, session recording, etc.)

## Alternative: Self-Hosted PeerJS

If you want PeerJS benefits but need self-hosting:

```bash
# Install PeerJS server
npm install -g peer

# Run server
peerjs --port 9000 --key peerjs --path /

# Use in your app
const peer = new Peer(peerId, {
    host: 'your-domain.com',
    port: 9000,
    path: '/',
    key: 'peerjs'
});
```

This gives you control while keeping the simple PeerJS API.

## Conclusion

**Recommendation: Migrate to Static + PeerJS**

For the Web MIDI Streamer use case:
- **Benefits**: Zero maintenance, free hosting, global CDN, simple deployment
- **Trade-offs**: Dependency on PeerJS (minimal risk, excellent service)
- **Complexity**: Actually **simpler** than current Python backend
- **Cost**: Free (current Python backend also free but requires server)

The PeerJS approach is modern, well-supported, and perfectly suited for peer-to-peer MIDI streaming. Unless you have specific enterprise requirements or privacy constraints, **this is the best path forward**.

### Implementation Effort
- **Time**: 2-4 hours to modify code and deploy
- **Risk**: Low - can test alongside existing backend
- **Reversibility**: Easy - keep Python code in separate branch

### Next Steps

1. Create a `peerjs` branch to test changes
2. Implement PeerJS connection code
3. Test with two browsers
4. Deploy to GitHub Pages for testing
5. If satisfied, make it the primary deployment
6. Keep Python backend code in repository for fallback

The migration will **simplify your infrastructure** while maintaining all functionality. This is a **good idea**.
   - Migration effort doesn't reduce complexity

3. **You'd lose benefits**
   - FastAPI is faster than PHP for this use case
   - Better async/await support
   - Simpler deployment with uvicorn
   - Better type hints and development experience

### ✅ **Better alternatives**:

1. **Keep Python** (Best option)
   - Current implementation is clean and efficient
   - FastAPI is modern and well-suited for WebSockets
   - Easy deployment with Docker, systemd, or cloud platforms

2. **Use Static + PeerJS** (If you want no backend maintenance)
   - Host HTML/CSS/JS on GitHub Pages/Netlify (free)
   - Use PeerJS hosted signaling server (free)
   - Example client change:
   ```javascript
   const peer = new Peer('room-' + roomName, {
       host: 'peerjs.com',
       port: 443,
       secure: true
   });
   ```


