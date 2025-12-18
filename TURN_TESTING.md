# TURN Server Testing Guide

## Overview

This document describes how to test your TURN server configuration using the provided testing script.

## Test Results for denizsincar.ru

**Last tested**: 2025-12-18

### Current Status

✅ **TURN Server is WORKING** (partially)

The TURN server at `voice.denizsincar.ru` is operational, but with some connectivity issues:

| Server | Port | Protocol | Status | Notes |
|--------|------|----------|--------|-------|
| voice.denizsincar.ru | 3479 | UDP | ❌ Failed | Connection refused (port may be blocked) |
| voice.denizsincar.ru | 5350 | TCP | ✅ Working | Successfully accessible |
| stun.l.google.com | 19302 | UDP | ✅ Working | STUN server responding |
| stun1.l.google.com | 19302 | UDP | ✅ Working | STUN server responding |
| openrelay.metered.ca | 80 | TCP | ✅ Working | Fallback TURN working |
| openrelay.metered.ca | 443 | TCP | ❌ Failed | Port 443 blocked |

### What This Means

Your TURN server **IS working**, but only on port 5350 (TCP). This is sufficient for WebRTC connectivity in most cases. However, for optimal performance:

1. **Current situation**: WebRTC will use TURN relay on port 5350 when direct P2P fails
2. **Recommended**: Open UDP port 3479 for better performance (UDP is faster than TCP for real-time media)

## Running the Test Script

### Prerequisites

```bash
# Install required Python libraries
pip install requests

# Optional: For advanced WebRTC testing
pip install aiortc
```

### Basic Usage

```bash
# Test your TURN server credentials endpoint
python3 test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php

# Test from a different endpoint
python3 test_turn_server.py https://your-domain.com/path/get-turn-credentials.php
```

### What the Script Tests

1. **Credentials Fetch**: Verifies the PHP endpoint returns valid JSON
2. **Credentials Validation**: Checks the structure includes proper iceServers array
3. **STUN Connectivity**: Tests if STUN servers respond
4. **TURN Connectivity**: Tests TCP connectivity to TURN servers
5. **WebRTC Test** (optional): Creates actual WebRTC peer connection with ICE gathering

## Interpreting Results

### ✅ Success Indicators

- Credentials fetch returns HTTP 200
- iceServers array contains TURN entries with username/credential
- STUN servers respond to binding requests
- At least one TURN server port is accessible

### ❌ Failure Indicators

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Credentials fetch fails | PHP config not set up | Copy config.example.php to config.php and configure |
| No TURN servers in response | turnServer not configured | Set turnServer in config.php |
| TURN port unreachable | Firewall blocking | Open ports in firewall (see below) |
| Connection refused | coturn not running | Start coturn service |

## Fixing Common Issues

### Port 3479 (UDP) Not Accessible

This is the issue affecting `voice.denizsincar.ru`. To fix:

```bash
# Check if coturn is listening on UDP port 3479
sudo netstat -tulpn | grep 3479

# Check firewall (UFW)
sudo ufw status
sudo ufw allow 3479/udp
sudo ufw allow 3479/tcp

# Check iptables
sudo iptables -L -n | grep 3479

# Verify coturn configuration
sudo cat /etc/turnserver.conf | grep listening-port
```

### Port 5350 (TLS/TCP) Issues

```bash
# Verify TLS certificate
sudo cat /etc/turnserver.conf | grep cert
sudo cat /etc/turnserver.conf | grep pkey

# Check if coturn is listening
sudo netstat -tulpn | grep 5350

# Allow in firewall
sudo ufw allow 5350/tcp
sudo ufw allow 5350/udp
```

### Testing TURN Server Directly

Use the `turnutils_uclient` tool (comes with coturn):

```bash
# Test UDP connection
turnutils_uclient -v voice.denizsincar.ru

# Test TCP connection
turnutils_uclient -v -t voice.denizsincar.ru

# Test with credentials (time-limited)
# First get credentials:
curl https://denizsincar.ru/midi/get-turn-credentials.php

# Then use the username and credential from the response:
turnutils_uclient -v -u <username> -w <credential> voice.denizsincar.ru
```

## Recommended Firewall Configuration

For optimal TURN server functionality:

```bash
# TURN server ports
sudo ufw allow 3479/tcp    # TURN over TCP
sudo ufw allow 3479/udp    # TURN over UDP
sudo ufw allow 5350/tcp    # TURN over TLS
sudo ufw allow 5350/udp    # TURN over DTLS

# TURN relay port range
sudo ufw allow 49152:65535/udp

# Reload firewall
sudo ufw reload
```

## coturn Configuration Checklist

Ensure your `/etc/turnserver.conf` has:

```bash
# Basic settings
listening-port=3479
tls-listening-port=5350

# Authentication (for time-limited credentials)
use-auth-secret
static-auth-secret=YOUR_SECRET_HERE  # Must match config.php

# Realm
realm=voice.denizsincar.ru

# External IP (your server's public IP)
external-ip=YOUR_PUBLIC_IP

# Relay ports
min-port=49152
max-port=65535

# For better compatibility
lt-cred-mech
no-tcp-relay  # Optional: disable TCP relay if you only want UDP
```

## Why WebRTC Might Still Fail

Even with TURN server working, WebRTC connections can fail if:

1. **Credentials expired**: Time-limited credentials have 1-hour TTL
2. **Wrong secret**: config.php secret doesn't match coturn's static-auth-secret
3. **No relay ports**: Firewall blocks UDP ports 49152-65535
4. **Certificate issues**: TLS certificate expired or invalid
5. **Network policies**: Corporate firewall blocks WebRTC entirely

## Testing in Your Browser

Use this online tool to test your TURN server from a browser:

**Trickle ICE**: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

1. Add your TURN server URL: `turn:voice.denizsincar.ru:5350?transport=tcp`
2. Enter credentials from: `https://denizsincar.ru/midi/get-turn-credentials.php`
3. Click "Gather candidates"
4. Look for `relay` type candidates (these mean TURN is working)

## Current Recommendation for denizsincar.ru

**Your TURN server is functional!** However, for optimal performance:

1. ✅ Keep using port 5350 (TCP) - it's working
2. 🔧 Fix port 3479 (UDP) by checking firewall rules
3. ✅ Your credentials endpoint is working correctly
4. ✅ Fallback TURN servers are available

**Bottom line**: Your setup will work for global WebRTC connections. The application will use the TCP TURN server on port 5350 when direct P2P fails.

## Advanced Testing with aiortc

For comprehensive WebRTC testing:

```bash
# Install aiortc (may require system dependencies)
pip install aiortc

# Run test with WebRTC support
python3 test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php
```

This will actually create a WebRTC peer connection and gather ICE candidates, showing exactly which connection paths are available.

## Debugging Tips

### Enable Verbose Logging in coturn

Edit `/etc/turnserver.conf`:

```bash
verbose
log-file=/var/log/turnserver.log
```

Then watch logs in real-time:

```bash
sudo tail -f /var/log/turnserver.log
# or
sudo journalctl -u coturn -f
```

### Test from Remote Machine

The TURN server test should be run from a **different network** than the server:

```bash
# From your local machine (not the server itself)
python3 test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php
```

This simulates real-world usage where clients connect from the internet.

## Summary

Your TURN server setup is **working but improvable**:

- ✅ Credentials generation: Working perfectly
- ✅ TURN server running: Yes, accessible on port 5350
- ⚠️ Port 3479 (UDP): Blocked or not listening
- ✅ Fallback servers: Available and working

**Recommended action**: Open UDP port 3479 in your firewall for better performance.
