/**
 * Web MIDI Streamer Application
 * Handles MIDI I/O, WebRTC connections, and UI interactions
 */

class MIDIStreamer {
    constructor() {
        // Configuration
        this.roomName = this.getRoomFromURL();
        this.ws = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.midiAccess = null;
        this.selectedInput = null;
        this.selectedOutput = null;
        
        // Settings
        this.sysexEnabled = false;
        this.timestampEnabled = false;
        this.audioFeedbackEnabled = false;
        this.showMidiActivity = false;
        
        // MIDI note names for accessibility
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
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
        
        // Send to peer via WebRTC
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const message = this.timestampEnabled 
                ? { data, timestamp: performance.now() }
                : { data };
            
            this.dataChannel.send(JSON.stringify(message));
        }
        
        // Announce MIDI activity for accessibility
        this.announceMIDIEvent(data);
    }
    
    /**
     * Handle incoming MIDI message from peer
     */
    handlePeerMIDIMessage(messageData) {
        if (!this.selectedOutput) return;
        
        const { data, timestamp } = messageData;
        
        // If timestamp is enabled, we could use it for timing adjustment
        // Currently sending immediately; timestamp info available for future enhancement
        
        // Send to MIDI output
        this.selectedOutput.send(data);
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
     * Connect to signaling server and establish WebRTC connection
     */
    async connect() {
        if (!this.roomName) {
            this.addMessage('No room specified in URL', 'error');
            return;
        }
        
        try {
            // Connect to WebSocket signaling server
            // Use the current page's path to determine the WebSocket URL
            // This supports deployment under subdirectories (e.g., /midi/)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const wsUrl = `${protocol}//${window.location.host}${basePath}ws/${this.roomName}`;
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.addMessage('Connected to signaling server', 'success');
                this.updateConnectionStatus('Connected to server');
            };
            
            this.ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                await this.handleSignalingMessage(message);
            };
            
            this.ws.onerror = (error) => {
                this.addMessage('WebSocket error', 'error');
            };
            
            this.ws.onclose = () => {
                this.addMessage('Disconnected from server', 'warning');
                this.updateConnectionStatus('Disconnected');
                this.updateUIState(false);
            };
            
            this.updateUIState(true);
            
        } catch (error) {
            this.addMessage(`Connection failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle signaling messages from server
     */
    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'joined':
                this.addMessage(`Joined room. Peers: ${message.peers}`, 'success');
                break;
                
            case 'ready':
                this.addMessage('Both peers connected. Initializing WebRTC...', 'success');
                await this.createPeerConnection(true);
                break;
                
            case 'offer':
                await this.handleOffer(message.offer);
                break;
                
            case 'answer':
                await this.handleAnswer(message.answer);
                break;
                
            case 'ice-candidate':
                await this.handleICECandidate(message.candidate);
                break;
                
            case 'peer_disconnected':
                this.addMessage('Peer disconnected', 'warning');
                this.closePeerConnection();
                break;
                
            case 'error':
                this.addMessage(message.message, 'error');
                break;
        }
    }
    
    /**
     * Create WebRTC peer connection
     */
    async createPeerConnection(isInitiator) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate
                }));
            }
        };
        
        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            this.updateConnectionStatus(`WebRTC: ${this.peerConnection.connectionState}`);
            if (this.peerConnection.connectionState === 'connected') {
                this.addMessage('WebRTC connection established!', 'success');
            }
        };
        
        if (isInitiator) {
            // Create data channel
            this.dataChannel = this.peerConnection.createDataChannel('midi');
            this.setupDataChannel();
            
            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.ws.send(JSON.stringify({
                type: 'offer',
                offer: offer
            }));
            this.addMessage('Sent WebRTC offer', 'info');
        } else {
            // Handle incoming data channel
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }
    }
    
    /**
     * Set up data channel event handlers
     */
    setupDataChannel() {
        this.dataChannel.onopen = () => {
            this.addMessage('Data channel open - ready to stream MIDI!', 'success');
        };
        
        this.dataChannel.onclose = () => {
            this.addMessage('Data channel closed', 'warning');
        };
        
        this.dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handlePeerMIDIMessage(message);
            } catch (error) {
                console.error('Error parsing MIDI message:', error);
            }
        };
    }
    
    /**
     * Handle incoming WebRTC offer
     */
    async handleOffer(offer) {
        await this.createPeerConnection(false);
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.ws.send(JSON.stringify({
            type: 'answer',
            answer: answer
        }));
        this.addMessage('Sent WebRTC answer', 'info');
    }
    
    /**
     * Handle incoming WebRTC answer
     */
    async handleAnswer(answer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.addMessage('Received WebRTC answer', 'info');
    }
    
    /**
     * Handle incoming ICE candidate
     */
    async handleICECandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
    
    /**
     * Close peer connection
     */
    closePeerConnection() {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
    
    /**
     * Disconnect from room
     */
    disconnect() {
        this.closePeerConnection();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.addMessage('Disconnected', 'info');
        this.updateConnectionStatus('Disconnected');
        this.updateUIState(false);
    }
    
    /**
     * Update connection status display
     */
    updateConnectionStatus(status) {
        document.getElementById('connectionStatus').textContent = status;
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
        // By default, only announce errors and warnings
        const shouldAnnounce = announce !== null ? announce : (type === 'error' || type === 'warning');
        
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
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MIDIStreamer();
});
