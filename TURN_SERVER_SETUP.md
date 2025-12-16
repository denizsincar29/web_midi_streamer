# TURN Server Setup Guide

## Why You Need a TURN Server

The application now includes **free public TURN servers** (openrelay.metered.ca) that work globally, not just on local networks. However, for production use or better performance, you should set up your own TURN server.

**What's the difference?**
- **STUN servers** (already included): Help discover your public IP - works on same WiFi or friendly NATs
- **TURN servers** (now included): Relay traffic when direct P2P fails - **needed for global internet connections**

## Quick Test

The app should now work globally without any setup! Try connecting from different networks (mobile data + WiFi).

## Option 1: Use Included Free TURN Servers (Default)

The app now uses `openrelay.metered.ca` TURN servers automatically:
- ✅ Works globally (not just local WiFi)
- ✅ No setup required
- ⚠️ Shared with other users (limited bandwidth)
- ⚠️ Not suitable for production/high usage

## Option 2: Set Up Your Own TURN Server (Recommended for Production)

### Install coturn on Ubuntu/Debian

1. **Install coturn**:
```bash
sudo apt update
sudo apt install coturn
```

2. **Enable coturn service**:
```bash
sudo systemctl enable coturn
```

3. **Configure coturn** (`/etc/turnserver.conf`):
```bash
# Basic configuration
listening-port=3478
tls-listening-port=5349

# Your server's external IP address
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm (your domain or server name)
realm=your-domain.com

# Enable long-term credentials
lt-cred-mech

# Create a user (username:password)
user=webmidi:SecurePassword123

# Relay configuration
min-port=49152
max-port=65535

# Logging
verbose
log-file=/var/log/turnserver.log

# Security
no-cli
fingerprint
```

4. **Get SSL certificate** (for TURN over TLS):
```bash
# Using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Add to /etc/turnserver.conf:
cert=/etc/letsencrypt/live/your-domain.com/cert.pem
pkey=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

5. **Start coturn**:
```bash
sudo systemctl start coturn
sudo systemctl status coturn
```

6. **Open firewall ports**:
```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

### Update Configuration

The app now includes free public TURN servers by default in `src/config.js`:

```javascript
export const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            // STUN servers
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Free public TURN servers (included by default)
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
};
```

To use your own TURN server instead, edit `src/config.js` and replace the TURN server entries:

```javascript
// Replace openrelay.metered.ca entries with your own TURN server
{
    urls: 'turn:your-domain.com:3478',
    username: 'webmidi',
    credential: 'SecurePassword123'
},
{
    urls: 'turn:your-domain.com:5349?transport=tcp',
    username: 'webmidi',
    credential: 'SecurePassword123'
}
```

## Option 3: Use Commercial TURN Service

For production without managing servers:
- **Twilio TURN** - https://www.twilio.com/stun-turn
- **Xirsys** - https://xirsys.com/
- **Metered** - https://www.metered.ca/tools/openrelay/

## Testing Your TURN Server

Use Trickle ICE test: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

1. Enter your TURN server URL: `turn:your-domain.com:3478`
2. Enter username and credential
3. Click "Gather candidates"
4. Look for `relay` type candidates - these indicate TURN is working

## Troubleshooting

### Connection only works on same WiFi
- **Cause**: No TURN server configured (STUN only)
- **Solution**: The app now includes public TURN servers - should work globally

### "Negotiation failed" error
- **Cause**: TURN server unreachable or incorrect credentials
- **Solution**: Check firewall rules and verify username/password

### High latency
- **Cause**: Traffic being relayed through TURN (not direct P2P)
- **Solution**: This is expected when direct connection fails - consider better network/firewall setup

### TURN server costs
- Free public TURN: Shared bandwidth, unreliable
- Self-hosted: ~$5-10/month VPS (Digital Ocean, Linode, etc.)
- Commercial: Pay per GB (~$0.40-1.00 per GB)

## Expected Behavior

With TURN servers configured:
1. **Best case**: Direct P2P connection (low latency, no relay)
2. **Good case**: TURN relay (higher latency, works globally)
3. **Failure**: No STUN/TURN servers or all servers unreachable

The app will automatically try direct connection first, then fallback to TURN relay if needed.
