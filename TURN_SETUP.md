# TURN Server Setup Guide

## Overview

The app ships with **free public STUN servers** only (see `DEFAULT_ICE_SERVERS` in
`src/webrtc.js`). STUN handles most cases — it finds the public address behind a
router. TURN is a relay and is only needed when both players sit behind
restrictive NATs or symmetric NATs that STUN cannot punch through.

Most users never need TURN. If a direct connection genuinely fails even after
retries, consider adding a TURN relay.

## Add a TURN server

There is no PHP or config file involved — ICE servers live in one place:

`src/webrtc.js`:

```js
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    // ... existing STUN servers ...
    {
        urls: 'turn:your-domain.com:3479?transport=udp',
        username: 'YOUR_USERNAME',
        credential: 'YOUR_PASSWORD',
    },
];
```

With a TURN server listed, the browser uses it automatically as a fallback when
a direct (host/STUN) path is unavailable. No app changes beyond this list.

## Run your own coturn (optional)

```bash
sudo apt update
sudo apt install coturn
sudo systemctl enable coturn
```

Edit `/etc/turnserver.conf`:

```text
lt-cred-mech
user=YOUR_USERNAME:YOUR_PASSWORD
realm=your-domain.com

listening-port=3479
tls-listening-port=5350
external-ip=YOUR_SERVER_PUBLIC_IP

min-port=49152
max-port=65535
```

Firewall:

```bash
sudo ufw allow 3479/tcp
sudo ufw allow 3479/udp
sudo ufw allow 5350/tcp
sudo ufw allow 49152:65535/udp
```

Then put the matching `username`/`credential` into `DEFAULT_ICE_SERVERS` and
restart coturn:

```bash
sudo systemctl restart coturn
```

> For a private jam between two known people, a static username/password is
> fine. For a public deployment, prefer time-limited credentials.

## Verify the connection type

Open the browser console — the app logs the winning path for each peer:

- `🏠 Host` — direct LAN
- `🌐 STUN (srflx)` — public internet path via STUN
- `🔁 TURN (relay)` — relayed through your TURN server

## Commercial TURN services (alternative)

- **Twilio** — pay-as-you-go, reliable
- **Xirsys** — WebRTC focused
- **Metered** — free tier available

Add their `turn:` URL, username and credential to `DEFAULT_ICE_SERVERS` the
same way.

## Security notes

- Never commit real TURN credentials. Keep them in the ICE server list only on
  the deployed copy, or use a build-time substitution.
- Use HTTPS in production so `wss://` signaling is used automatically.
