# WebRTC Signaling Server Setup

This application now uses a custom HTTP polling-based signaling server instead of PeerJS.

## Quick Start

1. **Configure TURN Server**
   ```bash
   cp config.example.php config.php
   ```
   Edit config.php and set:
   - `turnServer`: 'voice.denizsincar.ru'
   - `turnSecret`: Your static-auth-secret from coturn config

2. **Set up signaling directory**
   ```bash
   mkdir -p signaling_data
   chmod 755 signaling_data
   ```

3. **Start server**
   ```bash
   php -S localhost:8080
   ```

4. **Test connection**
   - User 1: Open http://localhost:8080 and click "Connect"
   - User 2: Open the shared URL from User 1
   - Connection should establish via signaling.php

## How It Works

### Architecture
```
Browser A ←──→ signaling.php ←──→ Browser B
    ↓                                   ↓
    └───────── WebRTC P2P ─────────────┘
```

### Signaling Flow
1. Both peers join a room via signaling.php
2. Initiator creates offer, sends via signaling
3. Receiver polls, gets offer, creates answer
4. ICE candidates exchanged through polling
5. Direct P2P connection established
6. Signaling no longer needed (only for monitoring)

### Files
- `signaling.php` - HTTP polling server for WebRTC signaling
- `get-turn-credentials.php` - Generates time-limited TURN credentials
- `src/webrtc.js` - Native WebRTC implementation
- `signaling_data/` - Temporary storage for signaling messages

### Polling
- Polls every 2 seconds for new messages
- Messages expire after 1 hour
- Room cleaned up when last peer leaves

## Production Deployment

For production, consider:

1. **Replace file storage** with Redis/Memcached
   ```php
   // In signaling.php
   $redis = new Redis();
   $redis->connect('127.0.0.1', 6379);
   ```

2. **Add authentication** to prevent abuse
3. **Set CORS properly** in config.php
4. **Use HTTPS** for production (required for getUserMedia)
5. **Monitor signaling_data/** size

## Troubleshooting

**Connection fails:**
- Check browser console for WebRTC errors
- Verify config.php has correct TURN secret
- Test TURN server: Use ?forceTurn=true parameter
- Check signaling.php is accessible

**Signaling errors:**
- Ensure signaling_data/ is writable
- Check PHP error log
- Verify CORS headers allow your domain

**TURN relay not working:**
- Verify coturn is running on voice.denizsincar.ru
- Check ports 3479 and 5350 are accessible
- Confirm static-auth-secret matches config.php
- Look for "relay" type ICE candidates in console

## Migration from PeerJS

The old PeerJS implementation is backed up as:
- `src/webrtc_old_peerjs.js`

To revert to PeerJS:
```bash
mv src/webrtc.js src/webrtc_native.js
mv src/webrtc_old_peerjs.js src/webrtc.js
# Add back PeerJS script to index.html
```
