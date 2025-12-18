# TURN Server Setup Guide

## Overview

The app includes **free public TURN servers** by default, so no setup is required for basic use. However, for production deployments or better performance, you can set up your own TURN server.

## Do You Need This?

**You probably don't!** The app works globally out of the box with included TURN servers.

Set up your own TURN server only if:
- You're deploying for production use
- You need better performance or reliability
- You want full control over your infrastructure

## Quick Setup (Optional)

### 1. Install coturn

```bash
sudo apt update
sudo apt install coturn
sudo systemctl enable coturn
```

### 2. Generate Credentials

```bash
# Generate a secure secret
openssl rand -base64 32

# Copy the output - you'll need it for both coturn and PHP config
```

### 3. Configure coturn

Edit `/etc/turnserver.conf`:

```bash
# Use time-limited credentials
use-auth-secret
static-auth-secret=YOUR_GENERATED_SECRET

# Your domain
realm=your-domain.com

# Ports
listening-port=3479
tls-listening-port=5350

# External IP
external-ip=YOUR_SERVER_PUBLIC_IP

# Security
lt-cred-mech
no-multicast-peers
no-loopback-peers

# Relay ports
min-port=49152
max-port=65535
```

### 4. Configure Firewall

```bash
sudo ufw allow 3479/tcp
sudo ufw allow 3479/udp
sudo ufw allow 5350/tcp
sudo ufw allow 49152:65535/udp
```

### 5. Configure Application

```bash
# Copy example config
cp config.example.php config.php
```

Edit `config.php`:

```php
return [
    'turnServer' => 'your-domain.com',
    'turnSecret' => 'YOUR_GENERATED_SECRET',  // Same secret as coturn
    'ttl' => 3600,
    'allowedOrigins' => ['https://yourdomain.com']
];
```

### 6. Restart and Test

```bash
sudo systemctl restart coturn

# Test with the included script
python3 test_turn_server.py https://yourdomain.com/get-turn-credentials.php
```

## Testing

### Test TURN Relay Mode

Add `?forceTurn=true` to your URL to force TURN relay:
```
https://yourdomain.com/?forceTurn=true
```

This disables direct P2P and forces all connections through TURN server.

### Verify Connection Type

Open browser console and check for these messages:
- `🔁 Using TURN relay connection` - TURN is working
- `🏠 Using host connection` - Direct P2P (local network)
- `🌐 Found public internet path` - STUN working

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port blocked | Check firewall: `sudo ufw status` |
| Connection refused | Verify coturn is running: `sudo systemctl status coturn` |
| Credentials invalid | Check secret matches in both coturn and config.php |
| Still using fallback TURN | Your TURN server is working! Free TURN is just backup |

## Commercial TURN Services (Alternative)

Instead of running your own TURN server, you can use:
- **Twilio** - Pay as you go, reliable
- **Xirsys** - WebRTC focused
- **Metered** - Free tier available

Update `get-turn-credentials.php` to return your commercial TURN credentials.

## Security Notes

- `config.php` is gitignored - never commit secrets
- Time-limited credentials expire after TTL (default: 1 hour)
- Use HTTPS for production
- Restrict `allowedOrigins` in production

## More Information

For detailed coturn configuration and advanced options, see the [official coturn documentation](https://github.com/coturn/coturn).
