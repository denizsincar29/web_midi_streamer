import { PEERJS_CONFIG, getTurnCredentials } from './config.js';
import { generatePeerId, shouldForceTurnRelay } from './utils.js';

export class WebRTCManager {
    constructor(onMessage, onStatusUpdate) {
        this.peer = null;
        this.dataChannel = null;
        this.onMessage = onMessage;
        this.onStatusUpdate = onStatusUpdate;
        this.onConnectionStateChange = null;
        this.pingStats = this.resetPingStats();
        this.manualDisconnect = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.connectionTypeReported = false; // Flag to report connection type only once
        
        // Reconnection constants
        this.RECONNECT_BASE_DELAY_MS = 1000;
        this.RECONNECT_BACKOFF_MULTIPLIER = 2;
        this.RECONNECT_MAX_DELAY_MS = 5000;
    }
    
    calculateReconnectDelay() {
        const exponentialDelay = this.RECONNECT_BASE_DELAY_MS * 
            Math.pow(this.RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempts - 1);
        return Math.min(exponentialDelay, this.RECONNECT_MAX_DELAY_MS);
    }

    resetPingStats() {
        return {
            count: 0,
            totalPings: 0,
            times: [],
            sentTimes: {},
            inProgress: false
        };
    }

    async connect(remotePeerId = null) {
        // Fetch fresh TURN credentials before connecting
        this.onStatusUpdate('🔑 Fetching TURN credentials...', 'info');
        const iceServers = await getTurnCredentials();
        
        // Check if we should force TURN relay for testing
        const forceTurn = shouldForceTurnRelay();
        if (forceTurn) {
            this.onStatusUpdate('⚠️ TURN relay mode: Forcing relay connection (P2P disabled)', 'warning');
        }
        
        const config = {
            ...PEERJS_CONFIG,
            config: {
                ...PEERJS_CONFIG.config,
                iceServers,
                // Force relay when testing TURN connectivity
                iceTransportPolicy: forceTurn ? 'relay' : 'all'
            }
        };
        
        const peerId = generatePeerId();
        this.peer = new Peer(peerId, config);
        
        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                this.onStatusUpdate('✅ Connected to PeerJS signaling server', 'success');
                this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
                
                if (remotePeerId) {
                    this.onStatusUpdate(`🔗 Attempting to connect to peer: ${remotePeerId}`, 'info');
                    const conn = this.peer.connect(remotePeerId, { reliable: true });
                    this.setupDataConnection(conn);
                    resolve(null);
                } else {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?peer=${id}`;
                    resolve(shareUrl);
                }
            });
            
            this.peer.on('connection', (conn) => {
                this.onStatusUpdate('Incoming peer connection...', 'info');
                this.setupDataConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                this.onStatusUpdate(`PeerJS error: ${err.type} - ${err.message}`, 'error');
                if (err.type === 'peer-unavailable') {
                    this.onStatusUpdate('The peer is not available. Make sure they are connected first.', 'error');
                }
                reject(err);
            });
            
            this.peer.on('disconnected', () => {
                this.onStatusUpdate('Disconnected from PeerJS server', 'warning');
                
                // Attempt automatic reconnection unless manually disconnected
                if (!this.manualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.calculateReconnectDelay();
                    this.onStatusUpdate(`Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'info');
                    
                    setTimeout(() => {
                        if (this.peer && !this.manualDisconnect) {
                            this.peer.reconnect();
                        }
                    }, delay);
                }
            });
            
            this.peer.on('close', () => {
                this.onStatusUpdate('PeerJS connection closed', 'warning');
            });
        });
    }

    setupDataConnection(conn) {
        this.dataChannel = conn;
        this.connectionTypeReported = false; // Reset flag for new connection
        this.onStatusUpdate('🔄 Starting WebRTC connection negotiation...', 'info');
        
        // Monitor for when peerConnection becomes available
        const setupMonitoring = () => {
            if (conn.peerConnection) {
                this.setupPeerConnectionMonitoring(conn.peerConnection);
            } else {
                // PeerConnection not ready yet, try again soon
                setTimeout(setupMonitoring, 50);
            }
        };
        setupMonitoring();
        
        conn.on('open', () => {
            this.onStatusUpdate('✅ Data channel open - ready to stream MIDI!', 'success');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(true);
            }
        });
        
        conn.on('data', (data) => {
            this.handleIncomingData(data);
        });
        
        conn.on('close', () => {
            this.onStatusUpdate('Peer disconnected', 'warning');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(false);
            }
        });
        
        conn.on('error', (err) => {
            this.onStatusUpdate(`❌ Data channel error: ${err.message}`, 'error');
        });
    }

    parseCandidateType(candidateString) {
        // Parse the candidate type from the SDP string
        // Example: "candidate:123456 1 udp 123456 192.168.1.1 12345 typ host"
        if (!candidateString || typeof candidateString !== 'string') return null;
        const match = candidateString.match(/\styp\s+(\w+)/);
        return match ? match[1] : null;
    }

    setupPeerConnectionMonitoring(pc) {
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
            
            // Log the ICE connection state for debugging
            console.log('ICE Connection State:', state);
            
            // When connected, log the actual connection type being used
            if ((state === 'connected' || state === 'completed') && !this.connectionTypeReported) {
                this.connectionTypeReported = true; // Report only once per connection
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
            
            // If failed, check if we have relay candidates
            if (state === 'failed') {
                console.error('WebRTC connection failed. Check:');
                console.error('1. TURN server credentials are valid');
                console.error('2. TURN server ports are accessible');
                console.error('3. Browser console for ICE candidate types (looking for "relay")');
            }
        };
        
        pc.onicegatheringstatechange = () => {
            console.log('ICE Gathering State:', pc.iceGatheringState);
            if (pc.iceGatheringState === 'gathering') {
                this.onStatusUpdate('📡 Gathering network candidates...', 'info');
            } else if (pc.iceGatheringState === 'complete') {
                this.onStatusUpdate('✅ Finished gathering network candidates', 'success');
            }
        };
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const candidate = event.candidate;
                
                // Skip logging if candidate has no meaningful data
                if (!candidate.candidate || candidate.candidate === '') {
                    console.log('ICE Candidate event with empty candidate data (may indicate gathering issues)');
                    return;
                }
                
                // Extract type from candidate - it may be in different properties depending on browser
                const type = candidate.type || this.parseCandidateType(candidate.candidate);
                const protocol = candidate.protocol || '';
                
                // Log with fallback for missing properties
                console.log('ICE Candidate discovered:', {
                    type: type || 'unknown',
                    protocol: protocol || 'unknown',
                    candidate: candidate.candidate
                });
                
                const messages = {
                    'host': '🏠 Found local network path',
                    'srflx': '🌐 Found public internet path (via STUN)',
                    'relay': '🔁 Found relay path (via TURN server)'
                };
                if (type && messages[type]) {
                    this.onStatusUpdate(messages[type], 'info');
                }
            } else {
                this.onStatusUpdate('✅ Finished discovering all connection paths', 'success');
                console.log('ICE candidate gathering completed');
            }
        };
    }

    handleIncomingData(data) {
        const message = typeof data === 'string' ? JSON.parse(data) : data;
        
        if (message.type === 'ping') {
            this.handlePing(message);
        } else if (message.type === 'pong') {
            this.handlePong(message);
        } else if (message.type === 'test_note') {
            this.onMessage({ type: 'test_note', data: message.data });
        } else {
            this.onMessage({ type: 'midi', data: message });
        }
    }

    send(data) {
        if (this.dataChannel && this.dataChannel.open) {
            this.dataChannel.send(data);
            return true;
        }
        return false;
    }

    sendPing() {
        if (!this.dataChannel || !this.dataChannel.open) {
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
                this.dataChannel.send({ type: 'ping', timestamp, pingId });
                this.pingStats.sentTimes[pingId] = timestamp;
            }, i * 100);
        }
    }

    handlePing(message) {
        if (this.dataChannel && this.dataChannel.open) {
            this.dataChannel.send({
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
        
        this.onStatusUpdate(
            `Ping test complete - Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms`,
            'success'
        );
    }

    disconnect() {
        this.manualDisconnect = true; // Prevent automatic reconnection
        this.reconnectAttempts = 0;
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }

    isConnected() {
        return this.dataChannel && this.dataChannel.open;
    }
}
