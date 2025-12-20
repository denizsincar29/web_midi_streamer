import { getRoomNameFromURL, copyToClipboard } from './utils.js';
import { MIDIManager } from './midi.js';
import { UIManager } from './ui.js';
import { WebRTCManager } from './webrtc.js';

class MIDIStreamer {
    constructor() {
        this.roomName = getRoomNameFromURL();
        this.settings = {
            sysexEnabled: false,
            timestampEnabled: false,
            audioFeedbackEnabled: false,
            showMidiActivity: false,
            midiEchoEnabled: false,
            ipv6Enabled: true  // Auto-try both IPv4 and IPv6 by default for better connectivity
        };
        
        // Flag to prevent infinite sync loops
        this.isUpdatingFromRemote = false;
        
        // Timestamp sync configuration
        this.MAX_TIMESTAMP_DELAY_MS = 10000; // Maximum acceptable delay (10 seconds)
        
        this.midi = new MIDIManager();
        this.ui = new UIManager(this.midi);
        this.webrtc = new WebRTCManager(
            (msg) => this.handleWebRTCMessage(msg),
            (text, type) => this.ui.addMessage(text, type)
        );
        
        // Pass initial IPv6 setting to WebRTC manager
        this.webrtc.ipv6Enabled = this.settings.ipv6Enabled;
        
        this.webrtc.onConnectionStateChange = (connected) => {
            this.ui.updateButtonStates(true, connected);
            if (connected) {
                this.ui.updateConnectionStatus('Connected to peer', 'connected');
            }
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Set initial checkbox states from settings
        document.getElementById('ipv6Enabled').checked = this.settings.ipv6Enabled;
        
        // Set initial room name from URL if present
        if (this.roomName) {
            document.getElementById('roomName').value = this.roomName;
        }
        
        // Check if TURN relay mode is enabled
        const params = new URLSearchParams(window.location.search);
        if (params.get('forceTurn') === 'true') {
            this.ui.addMessage('⚠️ TURN RELAY MODE: All connections will use TURN server (no direct P2P)', 'warning');
        }
        
        // Add cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
        
        try {
            await this.midi.init();
            this.ui.addMessage('MIDI access granted', 'success');
            this.midi.refreshDevices();
        } catch (error) {
            this.ui.addMessage(`MIDI access failed: ${error.message}`, 'error');
        }
        
        this.midi.onMessage = (data) => this.handleMIDIInput(data);
        
        if (this.roomName) {
            this.ui.updateRoomName(`Room: ${this.roomName}`);
            this.ui.addMessage(`Auto-connecting to room '${this.roomName}'...`, 'info');
            this.connect();
        } else {
            this.ui.updateRoomName('Enter Room Name');
            this.ui.addMessage('Enter a room name and click "Connect" to join', 'info');
        }
    }

    setupEventListeners() {
        document.getElementById('sysexEnabled').addEventListener('change', (e) => {
            this.settings.sysexEnabled = e.target.checked;
            this.ui.addMessage(`SysEx ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('timestampEnabled').addEventListener('change', (e) => {
            this.settings.timestampEnabled = e.target.checked;
            this.ui.addMessage(`Timestamp sync ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            
            // Send settings sync to remote peer (only if not updating from remote)
            if (!this.isUpdatingFromRemote && this.webrtc && this.webrtc.isConnected()) {
                this.webrtc.send({
                    type: 'settings_sync',
                    data: {
                        timestampEnabled: e.target.checked
                    }
                });
            }
        });
        
        document.getElementById('audioFeedbackEnabled').addEventListener('change', (e) => {
            this.settings.audioFeedbackEnabled = e.target.checked;
            this.ui.addMessage(`Audio feedback ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('showMidiActivity').addEventListener('change', (e) => {
            this.settings.showMidiActivity = e.target.checked;
            this.ui.toggleMidiActivity(e.target.checked);
            this.ui.addMessage(`MIDI activity display ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('midiInput').addEventListener('change', (e) => {
            this.midi.selectInput(e.target.value);
        });
        
        document.getElementById('midiOutput').addEventListener('change', (e) => {
            this.midi.selectOutput(e.target.value);
        });
        
        document.getElementById('refreshDevices').addEventListener('click', () => {
            this.midi.refreshDevices();
            this.ui.addMessage('MIDI devices refreshed', 'info');
        });
        
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
        document.getElementById('sendTestNoteBtn').addEventListener('click', () => this.sendTestNote());
        document.getElementById('sendPingBtn').addEventListener('click', () => this.webrtc.sendPing());
        
        document.getElementById('midiEchoEnabled').addEventListener('change', (e) => {
            this.settings.midiEchoEnabled = e.target.checked;
            this.ui.addMessage(`MIDI echo ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        });
        
        document.getElementById('ipv6Enabled').addEventListener('change', (e) => {
            this.settings.ipv6Enabled = e.target.checked;
            this.ui.addMessage(`IPv6 P2P ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            // Pass the setting to WebRTC manager if it exists
            if (this.webrtc) {
                this.webrtc.ipv6Enabled = e.target.checked;
            }
        });
    }

    async connect() {
        try {
            // Get room name from input field
            const roomName = document.getElementById('roomName').value.trim();
            
            if (!roomName) {
                this.ui.addMessage('Please enter a room name', 'error');
                return;
            }
            
            const shareUrl = await this.webrtc.connect(roomName);
            
            if (shareUrl) {
                this.ui.updateRoomName(`Room: ${roomName}`);
                this.ui.addMessage(`Connected to room '${roomName}'`, 'success');
                this.ui.addMessage(`Share this URL: ${shareUrl}`, 'info');
                
                // Display shareable link
                this.ui.displayShareableUrl(shareUrl, (url) => {
                    copyToClipboard(url)
                        .then(() => this.ui.addMessage('URL copied to clipboard!', 'success'))
                        .catch(() => this.ui.addMessage('Failed to copy URL. Please copy manually.', 'error'));
                });
            }
            
            this.ui.updateConnectionStatus('Waiting for peer...', 'connecting');
            this.ui.updateButtonStates(true, false);
        } catch (error) {
            this.ui.addMessage(`Connection failed: ${error.message}`, 'error');
        }
    }

    disconnect() {
        this.webrtc.disconnect();
        this.ui.addMessage('Disconnected', 'info');
        this.ui.updateConnectionStatus('Disconnected', 'disconnected');
        this.ui.updateButtonStates(false, false);
        // Re-enable automatic reconnection for future connections
        this.webrtc.manualDisconnect = false;
    }

    handleMIDIInput(data) {
        if (!this.settings.sysexEnabled && data[0] === 0xF0) {
            return;
        }
        
        const message = this.settings.timestampEnabled 
            ? { data, timestamp: performance.now() }
            : { data };
        
        this.webrtc.send(message);
        this.midi.announceMIDIEvent(data, this.settings.showMidiActivity);
    }

    handleWebRTCMessage(msg) {
        if (msg.type === 'test_note') {
            this.ui.addMessage(`Received test note via WebRTC: ${msg.data}`, 'success');
            this.midi.send(msg.data);
        } else if (msg.type === 'settings_sync') {
            // Remote peer changed their timestamp sync setting - sync ours
            if (msg.data.timestampEnabled !== undefined) {
                this.isUpdatingFromRemote = true;
                this.settings.timestampEnabled = msg.data.timestampEnabled;
                document.getElementById('timestampEnabled').checked = msg.data.timestampEnabled;
                this.ui.addMessage(`Timestamp sync ${msg.data.timestampEnabled ? 'enabled' : 'disabled'} by remote peer`, 'info');
                this.isUpdatingFromRemote = false;
            }
        } else if (msg.type === 'midi') {
            const { data, timestamp } = msg.data;
            
            // If timestamp is present, calculate delay and compensate
            if (timestamp && this.settings.timestampEnabled) {
                const now = performance.now();
                const rawDelay = now - timestamp;
                
                // Get estimated one-way latency from ping measurements
                const estimatedLatency = this.webrtc.getEstimatedLatency();
                
                // Calculate actual processing delay by subtracting network latency
                const processingDelay = rawDelay - estimatedLatency;
                
                // If delay is reasonable (not from clock skew), log it
                if (rawDelay >= 0 && rawDelay < this.MAX_TIMESTAMP_DELAY_MS) {
                    if (estimatedLatency > 0) {
                        // Guard against negative processing delay (can occur if latency estimation is off)
                        if (processingDelay < 0) {
                            console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms, Network latency: ${estimatedLatency.toFixed(2)}ms (Note: latency estimate may be high)`);
                        } else {
                            console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms, Network latency: ${estimatedLatency.toFixed(2)}ms, Processing delay: ${processingDelay.toFixed(2)}ms`);
                        }
                    } else {
                        console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms (run ping test for latency compensation)`);
                    }
                }
            }
            
            this.midi.send(data);
            
            if (this.settings.midiEchoEnabled && this.webrtc.isConnected()) {
                const echoMessage = this.settings.timestampEnabled 
                    ? { data, timestamp: performance.now() }
                    : { data };
                this.webrtc.send(echoMessage);
            }
        }
    }

    sendTestNote() {
        if (!this.webrtc.isConnected()) {
            this.ui.addMessage('Data channel not open', 'error');
            return;
        }
        
        const noteOnData = [0x90, 60, 100];
        this.webrtc.send({ type: 'test_note', data: noteOnData });
        this.ui.addMessage('Sent test note (C4) via WebRTC', 'info');
        
        setTimeout(() => {
            const noteOffData = [0x80, 60, 0];
            this.webrtc.send({ type: 'test_note', data: noteOffData });
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MIDIStreamer());
} else {
    new MIDIStreamer();
}
