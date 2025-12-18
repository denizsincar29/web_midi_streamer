# TURN Server Setup with Dynamic Credentials

This application now uses time-limited TURN credentials for enhanced security.

## Quick Setup

### 1. Create Your Configuration File

```bash
# Copy the example configuration
cp config.example.php config.php

# Generate a strong secret
openssl rand -base64 32
```

### 2. Update config.php

Edit `config.php` and update these values:

```php
return [
    'turnServer' => 'voice.denizsincar.ru',  // Your TURN server domain
    'turnSecret' => 'YOUR_GENERATED_SECRET',  // Paste the secret from step 1
    'ttl' => 3600,  // Credential lifetime (1 hour)
    'allowedOrigins' => ['*'],  // For production, set to ['https://yourdomain.com']
];
```

**Important**: `config.php` is gitignored, so your secret stays private!

### 3. Configure Your TURN Server (coturn)

Edit `/etc/turnserver.conf`:

```bash
# Use authentication secret for time-limited credentials
use-auth-secret

# Your static secret (use the SAME secret from step 1)
static-auth-secret=YOUR_GENERATED_SECRET

# Realm (should match your domain)
realm=voice.denizsincar.ru

# Listening ports
listening-port=3479
tls-listening-port=5350

# Other settings
lt-cred-mech
keep-address-family
no-multicast-peers
no-cli
no-loopback-peers
no-tcp-relay
no-tcp
no-tlsv1
no-tlsv1_1

# External IP (your server's public IP)
external-ip=YOUR_PUBLIC_IP

# Certificate for TLS (optional but recommended)
cert=/path/to/cert.pem
pkey=/path/to/privkey.pem
```

### 4. Restart coturn

```bash
sudo systemctl restart coturn
sudo systemctl status coturn
```

### 5. Test Your Setup

Test the TURN server with:

```bash
turnutils_uclient -v voice.denizsincar.ru
```

## Why This Approach?

### No More Git Conflicts!

- **config.example.php** is tracked in git (has placeholders)
- **config.php** is gitignored (has your real secrets)
- You can safely `git pull` without conflicts
- Your secrets never get committed

### Secure

- Secrets stay on the server (never in git history)
- Time-limited credentials (expire after 1 hour)
- TURN REST API compliant

## How It Works

1. **Client requests credentials**: When a user connects, the JavaScript calls `/get-turn-credentials.php`
2. **Backend generates time-limited credentials**: PHP creates a username (timestamp:webmidi) and password (HMAC-SHA1 hash)
3. **Credentials are valid for 1 hour**: After that, they expire automatically
4. **WebRTC uses these credentials**: To authenticate with your TURN server

## Security Benefits

- **Time-limited**: Credentials expire after 1 hour
- **No static passwords in JavaScript**: Each session gets unique credentials
- **Shared secret stays on server**: The static-auth-secret never leaves your server
- **TURN REST API compliant**: Standard implementation used by major WebRTC services

## Firewall Configuration

Make sure these ports are open:

```bash
sudo ufw allow 3479/tcp
sudo ufw allow 3479/udp
sudo ufw allow 5350/tcp
sudo ufw allow 5350/udp
sudo ufw allow 49152:65535/udp  # TURN relay ports
```

## Troubleshooting

### Test credential generation:
```bash
curl http://your-domain.com/get-turn-credentials.php
```

Should return JSON with iceServers configuration.

### Check coturn logs:
```bash
sudo tail -f /var/log/turnserver.log
# or
sudo journalctl -u coturn -f
```

### Verify TURN server is working:
```bash
turnutils_uclient -v voice.denizsincar.ru
```

## Alternative: Node.js Backend

If you prefer Node.js instead of PHP, create `get-turn-credentials.js`:

```javascript
const http = require('http');
const crypto = require('crypto');

const TURN_SERVER = 'voice.denizsincar.ru';
const TURN_SECRET = 'YOUR_STATIC_AUTH_SECRET';
const TTL = 3600;

http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const timestamp = Math.floor(Date.now() / 1000) + TTL;
    const username = timestamp + ':webmidi';
    const hmac = crypto.createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    
    res.end(JSON.stringify({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: `turn:${TURN_SERVER}:3479`,
                username,
                credential
            },
            {
                urls: `turn:${TURN_SERVER}:5350?transport=tcp`,
                username,
                credential
            }
        ]
    }));
}).listen(3000);
```

Run with: `node get-turn-credentials.js`
