#!/usr/bin/env python3
# /// script
# dependencies = [
#   "requests>=2.31.0",
#   "aiortc",
# ]
# ///
"""
TURN Server Testing Script

This script tests the TURN server by:
1. Fetching credentials from the PHP endpoint (e.g., denizsincar.ru/midi/get-turn-credentials.php)
2. Testing connectivity to the TURN server using those credentials
3. Validating that the TURN server is properly configured

Usage:
    uv run test_turn_server.py <credentials_url>
    
Example:
    uv run test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php

Note:
    - When using 'uv run', aiortc will be automatically installed for advanced WebRTC testing
    - If using python directly: pip install requests aiortc
"""

import sys
import json
import socket
import struct
import hashlib
import hmac
import asyncio
import time
import os
from urllib.parse import urlparse
from typing import Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    print("ERROR: requests library not found. Install with: pip install requests")
    sys.exit(1)

# Optional dependency for advanced WebRTC testing
try:
    import aiortc
    from aiortc import RTCPeerConnection, RTCConfiguration, RTCIceServer
    AIORTC_AVAILABLE = True
except ImportError:
    AIORTC_AVAILABLE = False
    print("WARNING: aiortc library not found. Advanced WebRTC testing unavailable.")
    print("Install with: pip install aiortc")
    print()


class TURNServerTester:
    """Tests TURN server connectivity and credential generation"""
    
    def __init__(self, credentials_url: str):
        self.credentials_url = credentials_url
        self.credentials = None
        self.test_results = {
            'credentials_fetch': False,
            'credentials_valid': False,
            'turn_servers': [],
            'stun_servers': [],
            'connectivity_tests': []
        }
    
    def fetch_credentials(self) -> bool:
        """Fetch TURN credentials from the PHP endpoint"""
        print(f"\n{'='*70}")
        print(f"Step 1: Fetching TURN credentials from endpoint")
        print(f"{'='*70}")
        print(f"URL: {self.credentials_url}")
        
        try:
            response = requests.get(self.credentials_url, timeout=10)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"ERROR: Failed to fetch credentials (HTTP {response.status_code})")
                print(f"Response: {response.text[:500]}")
                return False
            
            self.credentials = response.json()
            print(f"✓ Successfully fetched credentials")
            print(f"\nCredentials JSON structure:")
            print(json.dumps(self.credentials, indent=2))
            
            self.test_results['credentials_fetch'] = True
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Network error while fetching credentials: {e}")
            return False
        except json.JSONDecodeError as e:
            print(f"ERROR: Invalid JSON response: {e}")
            print(f"Response text: {response.text[:500]}")
            return False
    
    def validate_credentials(self) -> bool:
        """Validate the structure and content of fetched credentials"""
        print(f"\n{'='*70}")
        print(f"Step 2: Validating credentials structure")
        print(f"{'='*70}")
        
        if not self.credentials:
            print("ERROR: No credentials to validate")
            return False
        
        # Check for iceServers array
        if 'iceServers' not in self.credentials:
            print("ERROR: Missing 'iceServers' field in credentials")
            return False
        
        ice_servers = self.credentials['iceServers']
        if not isinstance(ice_servers, list):
            print("ERROR: 'iceServers' is not an array")
            return False
        
        print(f"Found {len(ice_servers)} ICE servers")
        
        # Categorize servers
        for i, server in enumerate(ice_servers):
            if 'urls' not in server:
                print(f"WARNING: Server {i} missing 'urls' field")
                continue
            
            urls = server['urls'] if isinstance(server['urls'], list) else [server['urls']]
            
            for url in urls:
                if url.startswith('stun:'):
                    self.test_results['stun_servers'].append({
                        'url': url,
                        'index': i
                    })
                    print(f"  [{i}] STUN server: {url}")
                    
                elif url.startswith('turn:'):
                    turn_info = {
                        'url': url,
                        'index': i,
                        'username': server.get('username', 'N/A'),
                        'credential': server.get('credential', 'N/A')[:20] + '...' if server.get('credential') else 'N/A'
                    }
                    self.test_results['turn_servers'].append(turn_info)
                    print(f"  [{i}] TURN server: {url}")
                    print(f"       Username: {turn_info['username']}")
                    print(f"       Credential: {turn_info['credential']}")
        
        if not self.test_results['turn_servers']:
            print("\nWARNING: No TURN servers found in credentials!")
            print("This means P2P will only work on local networks or with friendly NATs")
        else:
            print(f"\n✓ Found {len(self.test_results['turn_servers'])} TURN server(s)")
        
        self.test_results['credentials_valid'] = True
        return True
    
    def test_turn_server_basic(self, turn_url: str, username: str, credential: str) -> bool:
        """Basic connectivity test to TURN server"""
        print(f"\n{'='*70}")
        print(f"Step 3: Testing TURN server connectivity")
        print(f"{'='*70}")
        print(f"TURN URL: {turn_url}")
        
        # Parse TURN URL (manually because urlparse doesn't handle turn: scheme well)
        # Format: turn:host:port or turn:host:port?transport=tcp
        if not turn_url.startswith('turn:'):
            print(f"ERROR: Invalid TURN URL scheme")
            return False
        
        # Remove 'turn:' prefix
        url_part = turn_url[5:]
        
        # Check for query parameters
        transport = 'udp'
        if '?' in url_part:
            url_part, query = url_part.split('?', 1)
            if 'transport=tcp' in query:
                transport = 'tcp'
        
        # Parse host:port
        if ':' in url_part:
            host, port_str = url_part.rsplit(':', 1)
            try:
                port = int(port_str)
            except ValueError:
                port = 3478
        else:
            host = url_part
            port = 3478
        
        print(f"Host: {host}")
        print(f"Port: {port}")
        print(f"Transport: {transport}")
        print(f"Username: {username}")
        
        # Test basic connectivity
        print(f"\nTesting basic TCP connectivity to {host}:{port}...")
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                print(f"✓ TCP connection successful to {host}:{port}")
                return True
            else:
                print(f"✗ TCP connection failed to {host}:{port} (error code: {result})")
                return False
                
        except socket.gaierror as e:
            print(f"✗ DNS resolution failed for {host}: {e}")
            return False
        except socket.timeout:
            print(f"✗ Connection timeout to {host}:{port}")
            return False
        except Exception as e:
            print(f"✗ Connection error: {e}")
            return False
    
    def test_stun_server(self, stun_url: str) -> bool:
        """Test STUN server connectivity"""
        print(f"\nTesting STUN server: {stun_url}")
        
        # Parse STUN URL (manually because urlparse doesn't handle stun: scheme well)
        # Format: stun:host:port
        if not stun_url.startswith('stun:'):
            print(f"ERROR: Invalid STUN URL scheme")
            return False
        
        # Remove 'stun:' prefix
        url_part = stun_url[5:]
        
        # Parse host:port
        if ':' in url_part:
            host, port_str = url_part.rsplit(':', 1)
            try:
                port = int(port_str)
            except ValueError:
                port = 3478
        else:
            host = url_part
            port = 3478
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(3)
            
            # STUN Binding Request
            # Message Type: Binding Request (0x0001)
            # Message Length: 0 (no attributes)
            # Magic Cookie: 0x2112A442
            # Transaction ID: 96-bit random value
            transaction_id = os.urandom(12)
            
            # Build STUN message
            msg = struct.pack('!HH', 0x0001, 0)  # Type and Length
            msg += struct.pack('!I', 0x2112A442)  # Magic Cookie
            msg += transaction_id  # Transaction ID
            
            sock.sendto(msg, (host, port))
            
            try:
                data, addr = sock.recvfrom(1024)
                print(f"✓ STUN server {host}:{port} responded")
                sock.close()
                return True
            except socket.timeout:
                print(f"✗ STUN server {host}:{port} timeout")
                sock.close()
                return False
                
        except Exception as e:
            print(f"✗ STUN test error: {e}")
            return False
    
    async def test_webrtc_connection(self) -> bool:
        """Test actual WebRTC connection with TURN server (requires aiortc)"""
        if not AIORTC_AVAILABLE:
            print("\n⚠ Skipping WebRTC test (aiortc not installed)")
            return False
        
        print(f"\n{'='*70}")
        print(f"Step 4: Testing WebRTC connection with TURN server")
        print(f"{'='*70}")
        
        try:
            # Create RTCConfiguration with ICE servers
            ice_servers = []
            for server in self.credentials['iceServers']:
                urls = server['urls'] if isinstance(server['urls'], list) else [server['urls']]
                ice_server = RTCIceServer(
                    urls=urls,
                    username=server.get('username'),
                    credential=server.get('credential')
                )
                ice_servers.append(ice_server)
            
            config = RTCConfiguration(iceServers=ice_servers)
            pc = RTCPeerConnection(configuration=config)
            
            # Track ICE gathering state
            print("\nGathering ICE candidates...")
            
            @pc.on("icegatheringstatechange")
            async def on_ice_gathering_state_change():
                print(f"ICE Gathering State: {pc.iceGatheringState}")
            
            @pc.on("icecandidate")
            async def on_ice_candidate(candidate):
                if candidate:
                    print(f"Found ICE candidate: {candidate.candidate[:80]}...")
            
            # Create a data channel to trigger ICE gathering
            channel = pc.createDataChannel("test")
            
            # Create offer
            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            # Wait for ICE gathering to complete
            timeout = 10
            start_time = time.time()
            while pc.iceGatheringState != "complete":
                if time.time() - start_time > timeout:
                    print(f"⚠ ICE gathering timeout after {timeout}s")
                    break
                await asyncio.sleep(0.1)
            
            print(f"\n✓ WebRTC peer connection created successfully")
            print(f"ICE Gathering State: {pc.iceGatheringState}")
            
            # Close connection
            await pc.close()
            return True
            
        except Exception as e:
            print(f"✗ WebRTC test failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def print_summary(self):
        """Print test results summary"""
        print(f"\n{'='*70}")
        print(f"TEST SUMMARY")
        print(f"{'='*70}")
        
        print(f"\n✓ Credentials fetch: {'PASS' if self.test_results['credentials_fetch'] else 'FAIL'}")
        print(f"✓ Credentials valid: {'PASS' if self.test_results['credentials_valid'] else 'FAIL'}")
        print(f"\nSTUN Servers: {len(self.test_results['stun_servers'])}")
        print(f"TURN Servers: {len(self.test_results['turn_servers'])}")
        
        if self.test_results['connectivity_tests']:
            passed = sum(1 for t in self.test_results['connectivity_tests'] if t['success'])
            total = len(self.test_results['connectivity_tests'])
            print(f"\nConnectivity Tests: {passed}/{total} passed")
            
            for test in self.test_results['connectivity_tests']:
                status = "✓" if test['success'] else "✗"
                print(f"  {status} {test['type']}: {test['url']}")
        
        print(f"\n{'='*70}")
        
        # Provide recommendations
        if not self.test_results['turn_servers']:
            print("\n⚠ RECOMMENDATION: No TURN servers configured")
            print("   Your application will only work on local networks or with friendly NATs")
            print("   Consider setting up a TURN server for global connectivity")
        elif not any(t['success'] for t in self.test_results['connectivity_tests'] if 'turn:' in t['url']):
            print("\n⚠ RECOMMENDATION: TURN server connectivity issues detected")
            print("   Check your TURN server configuration:")
            print("   - Verify firewall allows ports 3478, 5349, and 49152-65535")
            print("   - Check coturn service is running: sudo systemctl status coturn")
            print("   - Verify static-auth-secret matches config.php")
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n{'*'*70}")
        print(f"TURN SERVER TESTING SUITE")
        print(f"{'*'*70}")
        print(f"Testing endpoint: {self.credentials_url}")
        print(f"{'*'*70}")
        
        # Test 1: Fetch credentials
        if not self.fetch_credentials():
            print("\n✗ FATAL: Cannot proceed without credentials")
            self.print_summary()
            return False
        
        # Test 2: Validate credentials
        if not self.validate_credentials():
            print("\n✗ FATAL: Invalid credentials structure")
            self.print_summary()
            return False
        
        # Test 3: Test connectivity to each server
        # Test STUN servers
        for stun in self.test_results['stun_servers']:
            success = self.test_stun_server(stun['url'])
            self.test_results['connectivity_tests'].append({
                'type': 'STUN',
                'url': stun['url'],
                'success': success
            })
        
        # Test TURN servers
        for turn in self.test_results['turn_servers']:
            # Get credentials from ice_servers
            ice_server = self.credentials['iceServers'][turn['index']]
            success = self.test_turn_server_basic(
                turn['url'],
                ice_server.get('username', ''),
                ice_server.get('credential', '')
            )
            self.test_results['connectivity_tests'].append({
                'type': 'TURN',
                'url': turn['url'],
                'success': success
            })
        
        # Test 4: WebRTC test (if aiortc available)
        if AIORTC_AVAILABLE:
            await self.test_webrtc_connection()
        
        # Print summary
        self.print_summary()
        
        return True


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: uv run test_turn_server.py <credentials_url>")
        print("\nExample:")
        print("  uv run test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php")
        print("\nAlternatively with python:")
        print("  python test_turn_server.py https://denizsincar.ru/midi/get-turn-credentials.php")
        print("\nThis script will:")
        print("  1. Fetch credentials from the endpoint")
        print("  2. Validate the credential structure")
        print("  3. Test connectivity to STUN/TURN servers")
        print("  4. Test WebRTC connection (if aiortc is installed)")
        sys.exit(1)
    
    credentials_url = sys.argv[1]
    
    # Validate URL
    try:
        parsed = urlparse(credentials_url)
        if not parsed.scheme or not parsed.netloc:
            print(f"ERROR: Invalid URL: {credentials_url}")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Invalid URL: {e}")
        sys.exit(1)
    
    # Run tests
    tester = TURNServerTester(credentials_url)
    
    # Use asyncio to run async tests
    try:
        asyncio.run(tester.run_all_tests())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
