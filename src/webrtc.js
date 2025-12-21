import { SIGNALING_CONFIG, getTurnCredentials } from './config.js';
import { generatePeerId, shouldForceTurnRelay } from './utils.js';

/**
 * WebRTC Manager using native WebRTC API with HTTP polling signaling
 * Replaces PeerJS with custom signaling server
 */
export class WebRTCManager {
    constructor(onMessage, onStatusUpdate) {
        this.peerConnection = null;
        this.dataChannel = null;
        this.onMessage = onMessage;
        this.onStatusUpdate = onStatusUpdate;
        this.onConnectionStateChange = null;
        
        // Connection state
        this.myPeerId = null;
        this.remotePeerId = null;
        this.roomId = null;
        this.isInitiator = false;
        this.hasEstablishedConnection = false;
        this.manualDisconnect = false;
        
        // IPv6 support (enabled by default for auto-try)
        this.ipv6Enabled = true;
        
        // ICE candidate queue for candidates that arrive before remote description
        this.pendingIceCandidates = [];
        this.MAX_PENDING_ICE_CANDIDATES = 50; // Prevent unbounded queue growth
        this.isProcessingPendingCandidates = false;
        
        // Signaling
        this.signalingUrl = null;
        this.pollingInterval = null;
        this.lastPollTimestamp = 0;
        
        // Ping/pong stats
        this.pingStats = this.resetPingStats();
        
        // Connection monitoring
        this.connectionTypeReported = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.RECONNECT_BASE_DELAY_MS = 1000;
        this.RECONNECT_BACKOFF_MULTIPLIER = 2;
        this.RECONNECT_MAX_DELAY_MS = 5000;
        this.CONNECTION_STABILIZATION_DELAY_MS = 1000; // Wait for connection to stabilize before ping
    }
    
    resetPingStats() {
        return {
            count: 0,
            totalPings: 0,
            times: [],
            sentTimes: {},
            inProgress: false,
            lastAvgRoundTripTime: 0  // Store the last average for timestamp compensation
        };
    }
    
    calculateReconnectDelay() {
        const exponentialDelay = this.RECONNECT_BASE_DELAY_MS * 
            Math.pow(this.RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempts - 1);
        return Math.min(exponentialDelay, this.RECONNECT_MAX_DELAY_MS);
    }

    /**
     * Connect to a room and establish WebRTC connection
     * @param {string} roomName - Room name to join
     * @returns {Promise<string>} Returns share URL with room name
     */
    async connect(roomName) {
        if (!roomName || typeof roomName !== 'string') {
            throw new Error('Room name is required');
        }
        
        this.onStatusUpdate('🔑 Fetching TURN credentials...', 'info');
        const iceServers = await getTurnCredentials();
        
        // Generate our peer ID
        this.myPeerId = generatePeerId();
        this.roomId = roomName; // Use room name directly as room ID
        this.isInitiator = false; // Will be determined by who's already in the room
        
        // Set up signaling URL
        let baseUrl = window.location.pathname;
        if (!baseUrl.endsWith('/')) {
            baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
        }
        this.signalingUrl = `${window.location.origin}${baseUrl}signaling.php`;
        
        // Join the room via signaling server
        this.onStatusUpdate('🔗 Connecting to signaling server...', 'info');
        
        try {
            const joinResponse = await fetch(
                `${this.signalingUrl}?action=join&room=${encodeURIComponent(this.roomId)}&peer=${this.myPeerId}`
            );
            const joinData = await joinResponse.json();
            
            if (!joinData.success) {
                throw new Error('Failed to join room');
            }
            
            this.onStatusUpdate('✅ Connected to signaling server', 'success');
            
            // Start polling for signaling messages
            this.startPolling();
            
            // Check if we should force TURN relay
            const forceTurn = shouldForceTurnRelay();
            if (forceTurn) {
                this.onStatusUpdate('⚠️ TURN relay mode: Forcing relay connection (P2P disabled)', 'warning');
            }
            
            // Create peer connection
            const config = {
                iceServers,
                iceCandidatePoolSize: 10,
                iceTransportPolicy: forceTurn ? 'relay' : 'all'
            };
            
            this.peerConnection = new RTCPeerConnection(config);
            this.setupPeerConnectionHandlers();
            
            // Clear any pending ICE candidates from previous connection
            this.pendingIceCandidates = [];
            
            // Always create data channel
            this.createDataChannel();
            
            // Check if there's already a peer in the room
            if (joinData.peers && joinData.peers.length > 0) {
                // Peer already in room, create offer
                this.remotePeerId = joinData.peers[0];
                this.isInitiator = true;
                await this.createOffer();
            } else {
                // First one in room, wait for other participant
                this.onStatusUpdate('⏳ Waiting for other participant to join...', 'info');
            }
            
            // Return shareable URL with room name
            const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`;
            return shareUrl;
            
        } catch (error) {
            this.onStatusUpdate(`❌ Connection failed: ${error.message}. Please check your internet connection and try again.`, 'error');
            throw error;
        }
    }
    
    setupPeerConnectionHandlers() {
        const pc = this.peerConnection;
        
        // ICE candidate handler
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const candidate = event.candidate;
                
                // Check if this is a valid candidate with data
                if (!candidate.candidate || candidate.candidate.trim() === '') {
                    console.log('ICE Candidate event with empty candidate string - skipping');
                    return;
                }
                
                // Filter candidates based on IPv6 setting
                if (!this.shouldUseCandidate(candidate)) {
                    const isIPv6 = this.isIPv6Candidate(candidate.candidate);
                    console.log(`Filtered out ${isIPv6 ? 'IPv6' : 'IPv4'} candidate (IPv6 ${this.ipv6Enabled ? 'enabled' : 'disabled'}):`, candidate.candidate);
                    return;
                }
                
                const type = candidate.type || this.parseCandidateType(candidate.candidate);
                const isIPv6 = this.isIPv6Candidate(candidate.candidate);
                console.log('ICE Candidate discovered:', {
                    type: type || 'unknown',
                    protocol: candidate.protocol || 'unknown',
                    ipVersion: isIPv6 ? 'IPv6' : 'IPv4',
                    candidate: candidate.candidate
                });
                
                const messages = {
                    'host': `🏠 Found local network path ${isIPv6 ? '(IPv6)' : '(IPv4)'}`,
                    'srflx': `🌐 Found public internet path ${isIPv6 ? '(IPv6)' : '(IPv4)'} (via STUN)`,
                    'relay': `🔁 Found relay path ${isIPv6 ? '(IPv6)' : '(IPv4)'} (via TURN server)`
                };
                if (type && messages[type]) {
                    this.onStatusUpdate(messages[type], 'info');
                }
                
                // Send ICE candidate via signaling
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    data: {
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex
                    }
                });
            } else {
                // Null candidate indicates end of candidate gathering
                this.onStatusUpdate('✅ Finished discovering all connection paths', 'success');
                console.log('ICE candidate gathering completed (null candidate received)');
                
                // Send end-of-candidates signal to remote peer
                // This helps the remote peer know that no more candidates will arrive
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    data: {
                        candidate: null,
                        sdpMid: null,
                        sdpMLineIndex: null
                    }
                });
            }
        };
        
        // ICE gathering state
        pc.onicegatheringstatechange = () => {
            console.log('ICE Gathering State:', pc.iceGatheringState);
            if (pc.iceGatheringState === 'gathering') {
                this.onStatusUpdate('📡 Gathering network candidates...', 'info');
            } else if (pc.iceGatheringState === 'complete') {
                this.onStatusUpdate('✅ Finished gathering network candidates', 'success');
            }
        };
        
        // ICE connection state
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            const messages = {
                'checking': '🔍 Checking network connectivity...',
                'connected': '✅ Network path established',
                'completed': '✅ Connection completed and stable',
                'failed': '❌ Direct P2P failed - attempting TURN relay...',
                'disconnected': '⚠️ Connection temporarily disconnected',
                'closed': '🔌 Connection closed'
            };
            if (messages[state]) {
                this.onStatusUpdate(messages[state], state === 'failed' ? 'error' : 'info');
            }
            
            console.log('ICE Connection State:', state);
            
            if ((state === 'connected' || state === 'completed') && !this.connectionTypeReported) {
                this.connectionTypeReported = true;
                pc.getStats().then(stats => {
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            const localCandidate = stats.get(report.localCandidateId);
                            const remoteCandidate = stats.get(report.remoteCandidateId);
                            if (localCandidate && remoteCandidate) {
                                const connectionType = localCandidate.candidateType;
                                console.log('Active connection type:', connectionType);
                                if (connectionType === 'relay') {
                                    this.onStatusUpdate('🔁 Using TURN relay connection', 'success');
                                } else if (connectionType === 'srflx') {
                                    this.onStatusUpdate('🌐 Using P2P via STUN (public IP)', 'success');
                                } else if (connectionType === 'host') {
                                    this.onStatusUpdate('🏠 Using direct P2P (local network)', 'success');
                                }
                            }
                        }
                    });
                }).catch(err => console.error('Error getting connection stats:', err));
            }
            
            if (state === 'failed') {
                console.error('WebRTC connection failed. Check:');
                console.error('1. TURN server credentials are valid');
                console.error('2. TURN server ports are accessible');
                console.error('3. Browser console for ICE candidate types (looking for "relay")');
            }
        };
        
        // Connection state change
        pc.onconnectionstatechange = () => {
            console.log('Connection State:', pc.connectionState);
        };
        
        // Data channel from remote peer
        pc.ondatachannel = (event) => {
            this.onStatusUpdate('📥 Incoming data channel...', 'info');
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers();
        };
    }
    
    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('midi-data', {
            ordered: true,
            maxRetransmits: 3
        });
        this.setupDataChannelHandlers();
    }
    
    setupDataChannelHandlers() {
        const dc = this.dataChannel;
        
        dc.onopen = () => {
            this.hasEstablishedConnection = true;
            this.onStatusUpdate('✅ Data channel open - ready to stream MIDI!', 'success');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(true);
            }
            
            // Automatically measure latency after connection is established
            setTimeout(() => {
                this.sendPing();
            }, this.CONNECTION_STABILIZATION_DELAY_MS);
        };
        
        dc.onmessage = (event) => {
            this.handleIncomingData(event.data);
        };
        
        dc.onclose = () => {
            this.hasEstablishedConnection = false;
            this.onStatusUpdate('Peer disconnected', 'warning');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(false);
            }
        };
        
        dc.onerror = (error) => {
            this.onStatusUpdate(`❌ Data channel error: ${error}`, 'error');
        };
    }
    
    async createOffer() {
        try {
            this.onStatusUpdate('🔗 Creating connection offer...', 'info');
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send offer via signaling
            await this.sendSignalingMessage({
                type: 'offer',
                data: {
                    sdp: offer.sdp,
                    type: offer.type
                }
            });
            
            this.onStatusUpdate('📤 Sent connection offer', 'info');
        } catch (error) {
            this.onStatusUpdate(`❌ Failed to create connection offer. Please try again.`, 'error');
        }
    }
    
    async handleOffer(offerData) {
        try {
            this.onStatusUpdate('📥 Received connection offer', 'info');
            
            // If we don't have a data channel yet and we're not the initiator, wait for it
            if (!this.dataChannel && !this.isInitiator) {
                // Data channel will be created by ondatachannel event
            }
            
            await this.peerConnection.setRemoteDescription({
                type: 'offer',
                sdp: offerData.sdp
            });
            
            // Process any ICE candidates that arrived before the remote description
            await this.processPendingIceCandidates();
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer via signaling
            await this.sendSignalingMessage({
                type: 'answer',
                data: {
                    sdp: answer.sdp,
                    type: answer.type
                }
            });
            
            this.onStatusUpdate('📤 Sent connection answer', 'info');
        } catch (error) {
            this.onStatusUpdate(`❌ Failed to accept connection. Please try again.`, 'error');
        }
    }
    
    async handleAnswer(answerData) {
        try {
            this.onStatusUpdate('📥 Received connection answer', 'info');
            await this.peerConnection.setRemoteDescription({
                type: 'answer',
                sdp: answerData.sdp
            });
            
            // Process any ICE candidates that arrived before the remote description
            await this.processPendingIceCandidates();
        } catch (error) {
            this.onStatusUpdate(`❌ Connection answer failed. Please try reconnecting.`, 'error');
        }
    }
    
    async handleIceCandidate(candidateData) {
        try {
            if (this.peerConnection.remoteDescription) {
                await this.addIceCandidate(candidateData);
            } else {
                // Queue candidates that arrive before remote description
                if (this.pendingIceCandidates.length < this.MAX_PENDING_ICE_CANDIDATES) {
                    console.log('Queuing ICE candidate (remote description not set yet)');
                    this.pendingIceCandidates.push(candidateData);
                } else {
                    console.warn('ICE candidate queue full, dropping candidate');
                }
            }
        } catch (error) {
            console.error('Failed to handle ICE candidate:', error);
        }
    }
    
    async addIceCandidate(candidateData) {
        // Handle end-of-candidates signal (null candidate)
        if (!candidateData.candidate) {
            console.log('Received end-of-candidates signal from remote peer');
            // Add null candidate to signal end of candidates to browser
            // This is the proper way to handle end-of-candidates in modern WebRTC
            try {
                await this.peerConnection.addIceCandidate(null);
            } catch (error) {
                // Some browsers don't support null candidate, which is fine
                console.log('Browser does not support null ICE candidate (this is normal for older browsers)');
            }
            return;
        }
        
        // Create a temporary candidate object to check if we should use it
        const tempCandidate = {
            candidate: candidateData.candidate,
            sdpMid: candidateData.sdpMid,
            sdpMLineIndex: candidateData.sdpMLineIndex
        };
        
        // Filter based on IPv6 setting
        if (!this.shouldUseCandidate(tempCandidate)) {
            const isIPv6 = this.isIPv6Candidate(candidateData.candidate);
            console.log(`Filtered incoming ${isIPv6 ? 'IPv6' : 'IPv4'} candidate from remote peer (IPv6 ${this.ipv6Enabled ? 'enabled' : 'disabled'})`);
            return;
        }
        
        await this.peerConnection.addIceCandidate({
            candidate: candidateData.candidate,
            sdpMid: candidateData.sdpMid,
            sdpMLineIndex: candidateData.sdpMLineIndex
        });
    }
    
    async processPendingIceCandidates() {
        // Prevent concurrent processing
        if (this.isProcessingPendingCandidates) {
            return;
        }
        
        if (this.pendingIceCandidates.length > 0) {
            this.isProcessingPendingCandidates = true;
            try {
                console.log(`Processing ${this.pendingIceCandidates.length} queued ICE candidate(s)`);
                const candidates = [...this.pendingIceCandidates];
                this.pendingIceCandidates = [];
                
                for (const candidateData of candidates) {
                    try {
                        await this.addIceCandidate(candidateData);
                    } catch (error) {
                        console.error('Failed to add queued ICE candidate:', error);
                    }
                }
            } finally {
                this.isProcessingPendingCandidates = false;
            }
        }
    }
    
    async sendSignalingMessage(message) {
        try {
            const fullUrl = `${this.signalingUrl}?action=send&peer=${this.myPeerId}&room=${this.roomId}`;
            const sendResponse = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: message.type,
                    data: message.data,
                    to: this.remotePeerId
                })
            });
            
            const result = await sendResponse.json();
            if (!result.success) {
                throw new Error('Failed to send signaling message');
            }
        } catch (error) {
            console.error('Error sending signaling message:', error);
        }
    }
    
    startPolling() {
        if (this.pollingInterval) {
            return; // Already polling
        }
        
        this.pollingInterval = setInterval(async () => {
            try {
                const url = `${this.signalingUrl}?action=poll&room=${this.roomId}&peer=${this.myPeerId}&since=${this.lastPollTimestamp}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.success && data.messages) {
                    for (const message of data.messages) {
                        await this.handleSignalingMessage(message);
                    }
                    this.lastPollTimestamp = data.timestamp;
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, SIGNALING_CONFIG.pollingInterval);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    async handleSignalingMessage(message) {
        // Set remote peer ID if we don't have it yet
        if (!this.remotePeerId && message.from && message.from !== this.myPeerId) {
            this.remotePeerId = message.from;
        }
        
        switch (message.type) {
            case 'offer':
                await this.handleOffer(message.data);
                break;
            case 'answer':
                await this.handleAnswer(message.data);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message.data);
                break;
            default:
                console.log('Unknown signaling message type:', message.type);
        }
    }
    
    parseCandidateType(candidateString) {
        if (!candidateString || typeof candidateString !== 'string') return null;
        const match = candidateString.match(/\styp\s+(\w+)/);
        return match ? match[1] : null;
    }
    
    /**
     * Check if an ICE candidate is IPv6
     * @param {string} candidateString - The ICE candidate string
     * @returns {boolean} True if the candidate is IPv6
     */
    isIPv6Candidate(candidateString) {
        if (!candidateString || typeof candidateString !== 'string') return false;
        
        // ICE candidate format (simplified): candidate:foundation component protocol priority ip port typ type
        // Note: Reflexive candidates may also include raddr and rport parameters
        // IPv6 addresses contain multiple colons (at least 2)
        
        // Match the standard ICE candidate format and extract the IP address (5th field)
        // Example: "candidate:842163049 1 udp 1686052607 192.168.1.1 51820 typ srflx"
        //          Groups:     foundation^ ^component ^protocol ^priority ^ip      ^port
        // The regex captures group 1 which is the IP address before the port number
        const match = candidateString.match(/candidate:\S+\s+\d+\s+\S+\s+\d+\s+(\S+)\s+\d+\s+typ/);
        
        if (match && match[1]) {
            const ipAddress = match[1];
            // IPv6 addresses have multiple colons (at least 2 for the shortest form ::1)
            // Count colons to reliably distinguish IPv6 from IPv4
            const colonCount = (ipAddress.match(/:/g) || []).length;
            return colonCount >= 2;
        }
        
        return false;
    }
    
    /**
     * Filter ICE candidate based on IPv6 setting
     * @param {RTCIceCandidate} candidate - The ICE candidate to check
     * @returns {boolean} True if the candidate should be used
     */
    shouldUseCandidate(candidate) {
        if (!candidate || !candidate.candidate) return false;
        
        const isIPv6 = this.isIPv6Candidate(candidate.candidate);
        
        // If IPv6 is enabled, accept all candidates (IPv4 and IPv6)
        if (this.ipv6Enabled) {
            return true;
        }
        
        // If IPv6 is disabled, only accept IPv4 candidates
        return !isIPv6;
    }
    
    handleIncomingData(data) {
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (message.type === 'ping') {
            this.handlePing(message);
        } else if (message.type === 'pong') {
            this.handlePong(message);
        } else if (message.type === 'test_note') {
            this.onMessage({ type: 'test_note', data: message.data });
        } else if (message.type === 'settings_sync') {
            this.onMessage({ type: 'settings_sync', data: message.data });
        } else if (message.type === 'chat') {
            this.onMessage({ type: 'chat', data: message.data });
        } else {
            this.onMessage({ type: 'midi', data: message });
        }
    }
    
    send(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.dataChannel.send(message);
            return true;
        }
        return false;
    }
    
    sendPing() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.onStatusUpdate('Data channel not open', 'error');
            return;
        }
        
        if (this.pingStats.inProgress) {
            this.onStatusUpdate('Ping test already in progress', 'warning');
            return;
        }
        
        this.pingStats = this.resetPingStats();
        this.pingStats.totalPings = 5;
        this.pingStats.inProgress = true;
        this.onStatusUpdate('Starting ping test (5 pings)...', 'info');
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const pingId = i + 1;
                const timestamp = performance.now();
                this.send({ type: 'ping', timestamp, pingId });
                this.pingStats.sentTimes[pingId] = timestamp;
            }, i * 100);
        }
    }
    
    handlePing(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.send({
                type: 'pong',
                timestamp: message.timestamp,
                pingId: message.pingId
            });
        }
    }
    
    handlePong(message) {
        if (!message || typeof message.timestamp !== 'number' || !message.pingId) {
            console.error('Invalid pong message received:', message);
            return;
        }
        
        const roundTripTime = performance.now() - message.timestamp;
        this.pingStats.count++;
        this.pingStats.times.push(roundTripTime);
        
        this.onStatusUpdate(`Ping ${message.pingId}/5: ${roundTripTime.toFixed(2)}ms`, 'success');
        
        if (this.pingStats.count >= this.pingStats.totalPings) {
            this.displayPingStatistics();
            this.pingStats.inProgress = false;
        }
    }
    
    displayPingStatistics() {
        const times = this.pingStats.times;
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        
        // Store the average for timestamp compensation
        this.pingStats.lastAvgRoundTripTime = avg;
        
        this.onStatusUpdate(
            `Ping test complete - Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms`,
            'success'
        );
    }
    
    /**
     * Get the estimated one-way latency based on ping measurements
     * @returns {number} One-way latency in milliseconds (half of round-trip time)
     */
    getEstimatedLatency() {
        return this.pingStats.lastAvgRoundTripTime / 2;
    }
    
    async disconnect() {
        this.manualDisconnect = true;
        this.hasEstablishedConnection = false;
        
        // Stop polling
        this.stopPolling();
        
        // Leave room via signaling
        if (this.roomId && this.myPeerId) {
            try {
                await fetch(`${this.signalingUrl}?action=leave&room=${this.roomId}&peer=${this.myPeerId}`);
            } catch (error) {
                console.error('Error leaving room:', error);
            }
        }
        
        // Close data channel
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clear pending ICE candidates to prevent errors on reconnect
        this.pendingIceCandidates = [];
        
        // Reset connection state
        this.myPeerId = null;
        this.remotePeerId = null;
        this.roomId = null;
        this.isInitiator = false;
        this.connectionTypeReported = false;
    }
    
    isConnected() {
        return this.dataChannel && this.dataChannel.readyState === 'open';
    }
}
