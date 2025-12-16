# TURN Server Setup with Dynamic Credentials

This application now uses time-limited TURN credentials for enhanced security.

## Setup Instructions

### 1. Configure Your TURN Server (coturn)

Edit `/etc/turnserver.conf` and ensure you have:

```bash
# Use authentication secret for time-limited credentials
use-auth-secret

# Your static secret (generate a strong random string)
static-auth-secret=YOUR_RANDOM_SECRET_HERE

# Realm (should match your domain)
realm=voice.denizsincar.ru

# Listening ports
listening-port=3478
tls-listening-port=5349

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

### 2. Generate a Strong Secret

```bash
# Generate a random secret
openssl rand -base64 32
```

Copy this secret and use it in both:
- `/etc/turnserver.conf` → `static-auth-secret=YOUR_SECRET`
- `get-turn-credentials.php` → `$turnSecret = 'YOUR_SECRET';`

### 3. Update the PHP File

Edit `get-turn-credentials.php` and replace:

```php
$turnSecret = 'YOUR_STATIC_AUTH_SECRET_HERE'; // Replace with your actual secret
```

With your actual secret from step 2.

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
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
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
                urls: `turn:${TURN_SERVER}:3478`,
                username,
                credential
            },
            {
                urls: `turn:${TURN_SERVER}:5349?transport=tcp`,
                username,
                credential
            }
        ]
    }));
}).listen(3000);
```

Run with: `node get-turn-credentials.js`
