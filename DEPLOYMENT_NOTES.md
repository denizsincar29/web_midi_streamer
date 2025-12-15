# Deployment Notes

## Changes in This Release

This release refactors the connection system to improve reliability and simplify usage.

### Key Changes

1. **Simplified Connection**: No longer requires `?room=` URL parameter
2. **Peer-to-Peer IDs**: Each connection gets a unique peer ID
3. **Fixed Connection Issues**: Resolved TURN server configuration errors
4. **Local PeerJS**: Included PeerJS library to avoid CDN issues

### Deployment Checklist

When deploying this version, ensure you include:

- [x] `index.html` - Main HTML file
- [x] `app.js` - Application JavaScript  
- [x] `peerjs.min.js` - PeerJS library (v1.5.2)
- [x] `style.css` - Stylesheet

### How Users Connect

**User 1 (Host):**
1. Open the app URL (e.g., `https://your-domain.com/`)
2. Click "Connect to Room"
3. Copy the generated shareable URL (e.g., `https://your-domain.com/?peer=midi-123456-abc`)
4. Share this URL with User 2

**User 2 (Guest):**
1. Open the shareable URL from User 1
2. Click "Connect to Room"  
3. Both users are now connected!

### Network Requirements

- **STUN Servers**: Used for NAT traversal (discovering public IP)
- **TURN Servers**: Used as relay for restrictive firewalls
- **Direct P2P**: Attempted first for best performance
- **Relay Fallback**: Automatic if direct connection fails

### Troubleshooting

**If connections fail:**
1. Check that both users are online
2. Ensure PeerJS cloud service is accessible
3. Verify firewall allows WebRTC traffic
4. Check browser console for specific error messages

**Common issues:**
- "Peer unavailable": Host must connect first before sharing URL
- Connection timeout: May indicate firewall blocking WebRTC
- MIDI not working: Check MIDI device permissions in browser

### Migration from Previous Version

No action required. Old URLs with `?room=` will still load but room parameter is ignored.
Users should switch to using the new `?peer=` URLs for connections.
