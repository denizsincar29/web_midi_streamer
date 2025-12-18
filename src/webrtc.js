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
        // Fetch fresh TURN credentials before connecting, passing status callback
        const iceServers = await getTurnCredentials((msg, type) => this.onStatusUpdate(msg, type));
        
        const forceTurn = shouldForceTurnRelay();
        if (forceTurn) {
            this.onStatusUpdate('⚠️ TURN relay mode: Forcing relay connection (P2P disabled)', 'warning');
        }
        
        const config = {
            ...PEERJS_CONFIG,
            config: {
                ...PEERJS_CONFIG.config,
                iceServers,
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
        this.connectionTypeReported = false;
        this.onStatusUpdate('🔄 Starting WebRTC connection negotiation...', 'info');

        // PeerJS lazy-creates the peerConnection, so we need to wait for it
        const monitor = () => {
            if (conn.peerConnection) {
                this.setupPeerConnectionMonitoring(conn.peerConnection);
            } else {
                setTimeout(monitor, 50);
            }
        };
        monitor();

        conn.on('open', () => {
            this.onStatusUpdate('✅ Data channel open - ready to stream MIDI!', 'success');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(true);
            }
        });

        conn.on('data', (data) => this.handleIncomingData(data));
        conn.on('close', () => {
            this.onStatusUpdate('Peer disconnected', 'warning');
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(false);
            }
        });
        conn.on('error', (err) => this.onStatusUpdate(`❌ Data channel error: ${err.message}`, 'error'));
    }

    /**
     * Sets up monitoring for the RTCPeerConnection to provide detailed status updates.
     * @param {RTCPeerConnection} pc The peer connection instance.
     */
    setupPeerConnectionMonitoring(pc) {
        const getCandidateType = (candidate) => {
            if (!candidate || typeof candidate.candidate !== 'string') return null;
            const match = candidate.candidate.match(/typ\s(\w+)/);
            return match ? match[1] : null;
        };

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                const type = getCandidateType(candidate);
                const messages = {
                    'host': '🏠 Found local network path',
                    'srflx': '🌐 Found public internet path (via STUN)',
                    'relay': '🔁 Found relay path (via TURN server)'
                };
                if (type && messages[type]) {
                    this.onStatusUpdate(messages[type], 'info');
                    console.log(`ICE Candidate: ${type} (${candidate.protocol}) ${candidate.address}:${candidate.port}`);
                }
            } else {
                console.log('ICE candidate gathering finished.');
            }
        };

        pc.oniceconnectionstatechange = async () => {
            const state = pc.iceConnectionState;
            console.log(`ICE Connection State: ${state}`);

            const messages = {
                'checking': '🔍 Checking network paths...',
                'connected': '✅ Network path established',
                'completed': '✅ Connection stable',
                'failed': '❌ Connection failed. Check network or TURN server.',
                'disconnected': '⚠️ Connection temporarily lost. Reconnecting...',
                'closed': '🔌 Connection closed'
            };

            if (messages[state]) {
                this.onStatusUpdate(messages[state], state === 'failed' ? 'error' : 'info');
            }

            if ((state === 'connected' || state === 'completed') && !this.connectionTypeReported) {
                try {
                    const stats = await pc.getStats();
                    for (const report of stats.values()) {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            const local = stats.get(report.localCandidateId);
                            if (local) {
                                const typeName = {
                                    'host': 'Direct P2P (local network)',
                                    'srflx': 'P2P via STUN (public IP)',
                                    'relay': 'TURN relay'
                                }[local.candidateType] || 'Unknown';

                                this.onStatusUpdate(`✅ Connected via ${typeName}`, 'success');
                                this.connectionTypeReported = true;
                                console.log(`Connection established using candidate type: ${local.candidateType}`);
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error getting connection stats:', err);
                }
            } else if (state === 'failed') {
                console.error('WebRTC connection failed. Troubleshooting tips:');
                console.error('1. Check browser console for ICE candidate errors.');
                console.error('2. Ensure TURN server is running and accessible (check ports).');
                console.error('3. Verify TURN credentials are correct.');
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
