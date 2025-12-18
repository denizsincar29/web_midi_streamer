import { getRemotePeerIdFromURL, copyToClipboard } from './utils.js';
import { MIDIManager } from './midi.js';
import { UIManager } from './ui.js';
import { WebRTCManager } from './webrtc.js';

class MIDIStreamer {
    constructor() {
        this.remotePeerId = getRemotePeerIdFromURL();
        this.settings = {
            sysexEnabled: false,
            timestampEnabled: false,
            audioFeedbackEnabled: false,
            showMidiActivity: false,
            midiEchoEnabled: false
        };
        
        this.ui = new UIManager();
        this.midi = new MIDIManager();
        this.webrtc = new WebRTCManager(
            (msg) => this.handleWebRTCMessage(msg),
            (text, type) => this.ui.addMessage(text, type)
        );
        
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
        
        if (this.remotePeerId) {
            this.ui.updateRoomName('Connecting to peer...');
            this.ui.addMessage(`Auto-connecting to peer...`, 'info');
            this.connect();
        } else {
            this.ui.updateRoomName('Create Connection');
            this.ui.addMessage('Click "Connect" to generate a shareable link', 'info');
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
    }

    async connect() {
        try {
            const shareUrl = await this.webrtc.connect(this.remotePeerId);
            
            if (shareUrl) {
                this.ui.updateRoomName('Connected');
                this.ui.addMessage(`Share this URL with peer: ${shareUrl}`, 'info');
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
        } else if (msg.type === 'midi') {
            const { data } = msg.data;
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
        this.ui.addMessage('Sent test note (C4) via PeerJS', 'info');
        
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
