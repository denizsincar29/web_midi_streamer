/**
 * Web MIDI Streamer Application
 * Handles MIDI I/O, WebRTC connections, and UI interactions
 */

// PeerJS Configuration
const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

class MIDIStreamer {
    constructor() {
        // Configuration
        this.roomName = this.getRoomFromURL();
        this.remotePeerId = this.getRemotePeerIdFromURL();
        this.peer = null;
        this.dataChannel = null;
        this.midiAccess = null;
        this.selectedInput = null;
        this.selectedOutput = null;
        
        // Settings
        this.sysexEnabled = false;
        this.timestampEnabled = false;
        this.audioFeedbackEnabled = false;
        this.showMidiActivity = false;
        this.midiEchoEnabled = false;
        
        // MIDI note names for accessibility
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Ping statistics
        this.pingStats = {
            count: 0,
            totalPings: 0,
            times: [],
            sentTimes: {},
            inProgress: false
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Get room name from URL parameter
     */
    getRoomFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('room') || null;
    }
    
    /**
     * Get remote peer ID from URL parameter
     */
    getRemotePeerIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('peer') || null;
    }
    
    /**
     * Initialize the application
     */
    async init() {
        this.setupUI();
        await this.initMIDI();
        
        if (this.roomName) {
            document.getElementById('roomName').textContent = this.roomName;
            this.addMessage(`Room "${this.roomName}" ready to connect`, 'info');
        } else {
            this.addMessage('No room specified. Add ?room=yourRoomName to URL', 'warning');
            document.getElementById('connectBtn').disabled = true;
        }
    }
    
    /**
     * Set up UI event listeners
     */
    setupUI() {
        // Settings checkboxes
        document.getElementById('sysexEnabled').addEventListener('change', (e) => {
            this.sysexEnabled = e.target.checked;
            this.addMessage(`SysEx ${this.sysexEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('timestampEnabled').addEventListener('change', (e) => {
            this.timestampEnabled = e.target.checked;
            this.addMessage(`Timestamp sync ${this.timestampEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('audioFeedbackEnabled').addEventListener('change', (e) => {
            this.audioFeedbackEnabled = e.target.checked;
            this.addMessage(`Audio feedback ${this.audioFeedbackEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('showMidiActivity').addEventListener('change', (e) => {
            this.showMidiActivity = e.target.checked;
            const midiActivity = document.getElementById('midiActivity');
            
            // Enable/disable ARIA live region
            if (this.showMidiActivity) {
                midiActivity.setAttribute('aria-live', 'assertive');
                midiActivity.classList.remove('sr-only');
            } else {
                midiActivity.setAttribute('aria-live', 'off');
                midiActivity.classList.add('sr-only');
                midiActivity.textContent = ''; // Clear any existing content
            }
            
            this.addMessage(`MIDI activity display ${this.showMidiActivity ? 'enabled' : 'disabled'}`, 'info');
        });
        
        // MIDI device selection
        document.getElementById('midiInput').addEventListener('change', (e) => {
            this.selectMIDIInput(e.target.value);
        });
        
        document.getElementById('midiOutput').addEventListener('change', (e) => {
            this.selectMIDIOutput(e.target.value);
        });
        
        document.getElementById('refreshDevices').addEventListener('click', () => {
            this.refreshMIDIDevices();
        });
        
        // Connection buttons
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connect();
        });
        
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnect();
        });
        
        // Debug buttons
        document.getElementById('sendTestNoteBtn').addEventListener('click', () => {
            this.sendTestNote();
        });
        
        document.getElementById('sendPingBtn').addEventListener('click', () => {
            this.sendPing();
        });
        
        document.getElementById('midiEchoEnabled').addEventListener('change', (e) => {
            this.midiEchoEnabled = e.target.checked;
            this.addMessage(`MIDI echo ${this.midiEchoEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
    }
    
    /**
     * Initialize Web MIDI API
     */
    async initMIDI() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            this.addMessage('MIDI access granted', 'success');
            this.refreshMIDIDevices();
            
            // Listen for device changes
            this.midiAccess.onstatechange = () => {
                this.refreshMIDIDevices();
            };
        } catch (error) {
            this.addMessage(`MIDI access failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Refresh MIDI device lists
     */
    refreshMIDIDevices() {
        const inputSelect = document.getElementById('midiInput');
        const outputSelect = document.getElementById('midiOutput');
        
        // Clear existing options
        inputSelect.innerHTML = '<option value="">No device selected</option>';
        outputSelect.innerHTML = '<option value="">No device selected</option>';
        
        // Check if MIDI access is available
        if (!this.midiAccess) {
            this.addMessage('MIDI access not available. Check browser permissions or try refreshing.', 'warning');
            return;
        }
        
        // Populate inputs
        for (let input of this.midiAccess.inputs.values()) {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name;
            inputSelect.appendChild(option);
        }
        
        // Populate outputs
        for (let output of this.midiAccess.outputs.values()) {
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name;
            outputSelect.appendChild(option);
        }
        
        this.addMessage('MIDI devices refreshed', 'info');
    }
    
    /**
     * Select MIDI input device
     */
    selectMIDIInput(deviceId) {
        // Remove previous listener
        if (this.selectedInput) {
            this.selectedInput.onmidimessage = null;
        }
        
        if (deviceId) {
            if (!this.midiAccess) {
                this.addMessage('MIDI access not available', 'error');
                return;
            }
            this.selectedInput = this.midiAccess.inputs.get(deviceId);
            this.selectedInput.onmidimessage = (event) => {
                this.handleMIDIMessage(event);
            };
            // Don't announce successful device selection, only failures
        } else {
            this.selectedInput = null;
        }
    }
    
    /**
     * Select MIDI output device
     */
    selectMIDIOutput(deviceId) {
        if (deviceId) {
            if (!this.midiAccess) {
                this.addMessage('MIDI access not available', 'error');
                return;
            }
            this.selectedOutput = this.midiAccess.outputs.get(deviceId);
            // Don't announce successful device selection, only failures
        } else {
            this.selectedOutput = null;
        }
    }
    
    /**
     * Handle incoming MIDI message from local device
     */
    handleMIDIMessage(event) {
        const data = Array.from(event.data);
        
        // Check if SysEx is disabled and this is a SysEx message
        if (!this.sysexEnabled && data[0] === 0xF0) {
            return; // Ignore SysEx messages when disabled
        }
        
        // Send to peer via PeerJS data connection
        if (this.dataChannel && this.dataChannel.open) {
            const message = this.timestampEnabled 
                ? { data, timestamp: performance.now() }
                : { data };
            
            this.dataChannel.send(message);
        }
        
        // Announce MIDI activity for accessibility
        this.announceMIDIEvent(data);
    }
    
    /**
     * Handle incoming MIDI message from peer
     */
    handlePeerMIDIMessage(messageData) {
        const { data, timestamp } = messageData;
        
        // Send to MIDI output if selected
        if (this.selectedOutput) {
            this.selectedOutput.send(data);
        }
        
        // Echo back if MIDI echo is enabled
        if (this.midiEchoEnabled && this.dataChannel && this.dataChannel.open) {
            // Send the same message back to the peer
            const echoMessage = this.timestampEnabled 
                ? { data, timestamp: performance.now() }
                : { data };
            
            this.dataChannel.send(echoMessage);
        }
    }
    
    /**
     * Announce MIDI events for accessibility
     */
    announceMIDIEvent(data) {
        // Only announce if MIDI activity display is enabled
        if (!this.showMidiActivity) return;
        
        const status = data[0] & 0xF0;
        const note = data[1];
        
        let announcement = '';
        
        if (status === 0x90 && data[2] > 0) { // Note On
            announcement = `${this.getNoteName(note)} on`;
        } else if (status === 0x80 || (status === 0x90 && data[2] === 0)) { // Note Off
            announcement = `${this.getNoteName(note)} off`;
        } else if (status === 0xB0) { // Control Change
            announcement = `CC ${data[1]}`;
        } else if (status === 0xC0) { // Program Change
            announcement = `Program ${data[1]}`;
        }
        
        if (announcement) {
            const midiActivity = document.getElementById('midiActivity');
            midiActivity.textContent = announcement;
        }
    }
    
    /**
     * Get note name from MIDI note number
     */
    getNoteName(midiNote) {
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = this.noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }
    
    /**
     * Connect to PeerJS and establish P2P connection
     */
    async connect() {
        if (!this.roomName) {
            this.addMessage('No room specified in URL', 'error');
            return;
        }
        
        try {
            // Create a unique peer ID based on room name and timestamp
            // This ensures each instance gets a unique ID while keeping room-based discovery possible
            const randomPart = crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2, 11);
            const peerId = `midi-${this.roomName}-${Date.now()}-${randomPart}`;
            
            // Create PeerJS connection with configuration
            this.peer = new Peer(peerId, PEERJS_CONFIG);
            
            this.peer.on('open', (id) => {
                this.addMessage(`Connected to PeerJS. Your ID: ${id}`, 'success');
                this.updateConnectionStatus('Waiting for peer...', 'connecting');
                
                // Generate shareable URL with our peer ID
                const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomName}&peer=${id}`;
                this.addMessage(`Share this URL with peer: ${shareUrl}`, 'info');
                
                // Display the share URL in the room name section
                this.displayShareableUrl(shareUrl);
                
                // If we have a remote peer ID from URL, try to connect
                if (this.remotePeerId) {
                    this.addMessage(`Attempting to connect to peer: ${this.remotePeerId}`, 'info');
                    const conn = this.peer.connect(this.remotePeerId, {
                        reliable: true
                    });
                    this.setupDataConnection(conn);
                }
            });
            
            // Listen for incoming connections
            this.peer.on('connection', (conn) => {
                this.addMessage('Incoming peer connection...', 'info');
                this.setupDataConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                this.addMessage(`PeerJS error: ${err.type} - ${err.message}`, 'error');
                this.updateConnectionStatus('Error', 'error');
                if (err.type === 'peer-unavailable') {
                    this.addMessage('The peer you are trying to connect to is not available. Make sure they are connected first.', 'error');
                }
            });
            
            this.peer.on('disconnected', () => {
                this.addMessage('Disconnected from PeerJS server', 'warning');
                this.updateConnectionStatus('Disconnected', 'warning');
            });
            
            this.peer.on('close', () => {
                this.addMessage('PeerJS connection closed', 'warning');
                this.updateConnectionStatus('Disconnected', 'disconnected');
                this.updateUIState(false);
            });
            
            this.updateUIState(true);
            
        } catch (error) {
            this.addMessage(`Connection failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Display a shareable URL for the peer to join
     */
    displayShareableUrl(url) {
        // Create a clickable/copyable element if it doesn't exist
        let shareSection = document.getElementById('shareUrlSection');
        if (!shareSection) {
            shareSection = document.createElement('div');
            shareSection.id = 'shareUrlSection';
            shareSection.className = 'share-url-section';
            
            const label = document.createElement('p');
            label.textContent = 'Share this URL with the other peer:';
            shareSection.appendChild(label);
            
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.id = 'shareUrl';
            urlInput.readOnly = true;
            urlInput.className = 'share-url-input';
            shareSection.appendChild(urlInput);
            
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy URL';
            copyBtn.className = 'btn btn-secondary';
            copyBtn.onclick = async () => {
                try {
                    // Try modern Clipboard API first
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(urlInput.value);
                        this.addMessage('URL copied to clipboard!', 'success');
                    } else {
                        // Fallback to execCommand for older browsers
                        urlInput.select();
                        document.execCommand('copy');
                        this.addMessage('URL copied to clipboard!', 'success');
                    }
                } catch (err) {
                    this.addMessage('Failed to copy URL. Please copy manually.', 'error');
                }
            };
            shareSection.appendChild(copyBtn);
            
            // Insert after the room info section
            const roomInfo = document.querySelector('.room-info');
            roomInfo.parentNode.insertBefore(shareSection, roomInfo.nextSibling);
        }
        
        // Update the URL
        document.getElementById('shareUrl').value = url;
    }
    
    /**
     * Set up PeerJS data connection event handlers
     */
    setupDataConnection(conn) {
        // Store the connection
        this.dataChannel = conn;
        
        conn.on('open', () => {
            this.addMessage('Data channel open - ready to stream MIDI!', 'success');
            this.updateConnectionStatus('Connected to peer', 'connected');
            this.updateDebugButtonsState(true);
        });
        
        conn.on('data', (data) => {
            try {
                // PeerJS sends data as objects directly (already parsed)
                const message = typeof data === 'string' ? JSON.parse(data) : data;
                
                // Check if it's a special control message
                if (message.type === 'ping') {
                    this.handlePing(message);
                } else if (message.type === 'pong') {
                    this.handlePong(message);
                } else if (message.type === 'test_note') {
                    this.handleTestNote(message.data);
                } else {
                    // Regular MIDI message
                    this.handlePeerMIDIMessage(message);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
        
        conn.on('close', () => {
            this.addMessage('Peer disconnected', 'warning');
            this.updateConnectionStatus('Peer disconnected', 'warning');
            this.updateDebugButtonsState(false);
        });
        
        conn.on('error', (err) => {
            this.addMessage(`Data channel error: ${err.message}`, 'error');
        });
    }
    
    /**
     * Disconnect from room
     */
    disconnect() {
        // Close the data connection
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        // Destroy the peer connection
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.addMessage('Disconnected', 'info');
        this.updateConnectionStatus('Disconnected', 'disconnected');
        this.updateUIState(false);
    }
    
    /**
     * Update connection status display with visual indicator
     */
    updateConnectionStatus(status, state = 'disconnected') {
        document.getElementById('connectionStatus').textContent = status;
        
        // Update visual indicator
        const indicator = document.getElementById('statusIndicator');
        indicator.className = 'status-indicator ' + state;
        
        // Update screen reader status bar
        const statusBar = document.getElementById('statusBar');
        statusBar.textContent = `Connection status: ${status}`;
    }
    
    /**
     * Update UI state based on connection
     */
    updateUIState(connected) {
        document.getElementById('connectBtn').disabled = connected;
        document.getElementById('disconnectBtn').disabled = !connected;
    }
    
    /**
     * Add message to log
     */
    /**
     * Add message to log
     * @param {string} text - Message text
     * @param {string} type - Message type (info, success, error, warning)
     * @param {boolean} announce - Whether to announce to screen readers (default: true for errors/warnings, false for others)
     */
    addMessage(text, type = 'info', announce = null) {
        const messageLog = document.getElementById('messageLog');
        const message = document.createElement('div');
        message.className = `message ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        
        // Create separate spans for timestamp and text
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'message-timestamp';
        timestampSpan.setAttribute('aria-hidden', 'true'); // Hide timestamp from screen readers
        timestampSpan.textContent = `[${timestamp}] `;
        
        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';
        textSpan.textContent = text;
        
        message.appendChild(timestampSpan);
        message.appendChild(textSpan);
        
        // Determine if this message should be announced to screen readers
        // Announce errors, warnings, and connection-related success messages
        const isConnectionMessage = type === 'success' && (
            text.includes('Connected') || 
            text.includes('connection') ||
            text.includes('Data channel open') ||
            text.includes('Joined room')
        );
        
        const shouldAnnounce = announce !== null ? announce : (
            type === 'error' || 
            type === 'warning' || 
            isConnectionMessage
        );
        
        if (!shouldAnnounce) {
            message.setAttribute('aria-live', 'off');
        }
        
        messageLog.appendChild(message);
        messageLog.scrollTop = messageLog.scrollHeight;
        
        // Limit messages to 50
        while (messageLog.children.length > 50) {
            messageLog.removeChild(messageLog.firstChild);
        }
    }
    
    /**
     * Update debug buttons state
     */
    updateDebugButtonsState(enabled) {
        document.getElementById('sendTestNoteBtn').disabled = !enabled;
        document.getElementById('sendPingBtn').disabled = !enabled;
    }
    
    /**
     * Send test MIDI note (C4 note on)
     */
    sendTestNote() {
        if (this.dataChannel && this.dataChannel.open) {
            // MIDI: Note On, Channel 1, Note 60 (C4), Velocity 100
            const noteOnData = [0x90, 60, 100];
            
            this.dataChannel.send({
                type: 'test_note',
                data: noteOnData
            });
            
            this.addMessage('Sent test note (C4) via PeerJS', 'info');
            
            // Send note off after 500ms
            setTimeout(() => {
                const noteOffData = [0x80, 60, 0];
                this.dataChannel.send({
                    type: 'test_note',
                    data: noteOffData
                });
            }, 500);
        } else {
            this.addMessage('Data channel not open', 'error');
        }
    }
    
    /**
     * Send ping message
     */
    sendPing() {
        if (this.dataChannel && this.dataChannel.open) {
            // Check if a ping test is already in progress
            if (this.pingStats.inProgress) {
                this.addMessage('Ping test already in progress', 'warning');
                return;
            }
            
            // Reset ping statistics
            this.pingStats = {
                count: 0,
                totalPings: 5,
                times: [],
                sentTimes: {},
                inProgress: true
            };
            
            this.addMessage('Starting ping test (5 pings)...', 'info');
            
            // Send 5 pings with 100ms delay between each
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const pingId = i + 1;
                    const timestamp = performance.now();
                    
                    this.dataChannel.send({
                        type: 'ping',
                        timestamp: timestamp,
                        pingId: pingId
                    });
                    
                    // Store the sent timestamp
                    this.pingStats.sentTimes[pingId] = timestamp;
                    
                }, i * 100);
            }
        } else {
            this.addMessage('Data channel not open', 'error');
        }
    }
    
    /**
     * Handle incoming ping
     */
    handlePing(message) {
        // Echo back the ping with the original timestamp and pingId
        if (this.dataChannel && this.dataChannel.open) {
            this.dataChannel.send({
                type: 'pong',
                timestamp: message.timestamp,
                pingId: message.pingId
            });
        }
    }
    
    /**
     * Handle incoming pong
     */
    handlePong(message) {
        // Validate message has required fields
        if (!message || typeof message.timestamp !== 'number' || !message.pingId) {
            console.error('Invalid pong message received:', message);
            return;
        }
        
        const now = performance.now();
        const roundTripTime = now - message.timestamp;
        
        this.pingStats.count++;
        this.pingStats.times.push(roundTripTime);
        
        // Display individual ping result
        this.addMessage(`Ping ${message.pingId}/5: ${roundTripTime.toFixed(2)}ms`, 'success');
        
        // Check if all pings are complete
        if (this.pingStats.count >= this.pingStats.totalPings) {
            this.displayPingStatistics();
            this.pingStats.inProgress = false;
        }
    }
    
    /**
     * Display ping statistics summary
     */
    displayPingStatistics() {
        const times = this.pingStats.times;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        
        this.addMessage(
            `Ping test complete - Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms`,
            'success'
        );
    }
    
    /**
     * Handle test note from peer
     */
    handleTestNote(data) {
        this.addMessage(`Received test note via WebRTC: ${data}`, 'success');
        
        // Play the note if output is selected
        if (this.selectedOutput) {
            this.selectedOutput.send(data);
        }
    }
}

// Initialize application when DOM is ready
// Check if DOM is already loaded (in case script loads after DOMContentLoaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MIDIStreamer();
    });
} else {
    // DOM is already ready, initialize immediately
    new MIDIStreamer();
}
