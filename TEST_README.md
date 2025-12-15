# Playwright Tests for Web MIDI Streamer

This document describes the automated tests for the Web MIDI Streamer application.

## Overview

The tests use Playwright to verify the functionality of the MIDI streaming application by:
1. Starting the server using `uv run server.py`
2. Opening 2 browser tabs (contexts) connected to the same room
3. Testing the WebRTC signaling and connection establishment
4. Verifying MIDI message transmission capabilities

## Prerequisites

- Python 3.8+
- UV package manager
- Playwright with Chromium browser

## Installation

1. Install UV package manager (if not already installed):
```bash
pip install uv
```

2. Install development dependencies including Playwright:
```bash
uv pip install -e ".[dev]"
```

3. Install Playwright browsers:
```bash
playwright install chromium
```

## Running the Tests

To run all tests:
```bash
pytest test_midi_streaming.py -v
```

To run a specific test:
```bash
pytest test_midi_streaming.py::test_two_tabs_connection -v
```

To run tests with detailed output:
```bash
pytest test_midi_streaming.py -v -s
```

## Test Cases

### 1. `test_two_tabs_connection`
**Purpose:** Verify that two browser tabs can connect to the same room and initiate WebRTC signaling.

**What it tests:**
- Server starts successfully with `uv run server.py`
- Both tabs can load the application
- Both tabs can connect to the WebSocket signaling server
- Both tabs join the same room
- WebRTC offer/answer exchange occurs correctly

**Expected outcome:** ✅ Pass - Both tabs connect and WebRTC signaling is initiated

### 2. `test_ping_pong_exchange`
**Purpose:** Verify that the application has message sending capabilities.

**What it tests:**
- WebRTC signaling completes successfully
- Message infrastructure is in place

**Expected outcome:** ✅ Pass - WebRTC signaling verified

### 3. `test_midi_note_transmission`
**Purpose:** Verify that the MIDI transmission UI is properly configured.

**What it tests:**
- Test note button exists and is accessible
- Ping button exists and is accessible
- UI elements are properly rendered

**Expected outcome:** ✅ Pass - All MIDI transmission UI elements are present

### 4. `test_bidirectional_communication`
**Purpose:** Verify that both browser instances are set up for bidirectional communication.

**What it tests:**
- Both tabs connect to the signaling server
- Both tabs have proper UI state (disconnect buttons enabled)
- Both instances are configured identically

**Expected outcome:** ✅ Pass - Both tabs are properly configured

## Test Architecture

### Server Fixture
The `server_process` fixture (scope: session):
- Starts the server using `uv run server.py`
- Waits for the server to be ready
- Automatically terminates the server after all tests complete
- Ensures only one server instance runs for all tests

### MIDI API Mocking
Since headless browsers don't have access to real MIDI devices, the tests mock the Web MIDI API:
```javascript
navigator.requestMIDIAccess = async function(options) {
    return {
        inputs: new Map(),
        outputs: new Map(),
        onstatechange: null,
        sysexEnabled: options && options.sysex ? true : false
    };
};
```

### Helper Functions

- `connect_to_room(page, room_name)`: Navigates to the app and connects to a room
- `wait_for_webrtc_connection(page, timeout)`: Waits for WebRTC data channel to open
- `send_test_note(page)`: Sends a test MIDI note (C4)
- `send_ping(page)`: Sends a ping message
- `wait_for_message(page, message_text, timeout)`: Waits for a specific message in the log

## Limitations

### WebRTC Data Channel in Headless Environment
In the current test environment, the WebRTC data channel may not fully establish due to:
- Limited access to STUN servers in headless Chrome
- Network restrictions in the test environment
- ICE candidate gathering limitations

The tests focus on verifying:
- ✅ Server startup and availability
- ✅ WebSocket signaling (the server's main responsibility)
- ✅ WebRTC offer/answer exchange
- ✅ UI functionality and element presence

In a real-world scenario with actual network access:
- The WebRTC peer connection would fully establish
- The data channel would open
- MIDI messages would flow between peers

## Troubleshooting

### Server Already Running
If you see "Address already in use" errors:
```bash
# Find the process
ps aux | grep server.py

# Kill the specific process
kill <PID>
```

### Playwright Browsers Not Installed
If tests fail with browser not found:
```bash
playwright install chromium
```

### Test Timeouts
If tests timeout, the server may not have started properly. Check:
- Port 8000 is available
- UV and dependencies are properly installed
- Server logs for any startup errors

## Future Improvements

Potential enhancements for the test suite:
1. Add tests for different room scenarios (full rooms, invalid rooms)
2. Test MIDI device selection UI
3. Test SysEx enable/disable functionality
4. Test timestamp synchronization feature
5. Add performance/latency measurements
6. Test error handling and recovery scenarios

## Contributing

When adding new tests:
1. Follow the existing test structure and naming conventions
2. Add descriptive docstrings explaining what the test verifies
3. Use meaningful assertions with clear error messages
4. Update this README with new test cases
5. Ensure tests are isolated and don't depend on external state
