import { PEERJS_CONFIG } from './config.js';
import { generatePeerId } from './utils.js';

export class WebRTCManager {
    constructor(onMessage, onStatusUpdate) {
        this.peer = null;
        this.dataChannel = null;
        this.onMessage = onMessage;
        this.onStatusUpdate = onStatusUpdate;
        this.onConnectionStateChange = null;
        this.pingStats = this.resetPingStats();
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
        const peerId = generatePeerId();
        this.peer = new Peer(peerId, PEERJS_CONFIG);
        
        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                this.onStatusUpdate('✅ Connected to PeerJS signaling server', 'success');
                
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
            });
            
            this.peer.on('close', () => {
                this.onStatusUpdate('PeerJS connection closed', 'warning');
            });
        });
    }

    setupDataConnection(conn) {
        this.dataChannel = conn;
        this.onStatusUpdate('🔄 Starting WebRTC connection negotiation...', 'info');
        
        if (conn.peerConnection) {
            this.setupPeerConnectionMonitoring(conn.peerConnection);
        }
        
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

    setupPeerConnectionMonitoring(pc) {
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            const messages = {
                'checking': '🔍 Checking network connectivity...',
                'connected': '✅ Network path established',
                'completed': '✅ Connection completed and stable',
                'failed': '❌ Direct P2P failed',
                'disconnected': '⚠️ Connection temporarily disconnected',
                'closed': '🔌 Connection closed'
            };
            if (messages[state]) {
                this.onStatusUpdate(messages[state], state === 'failed' ? 'error' : 'info');
            }
        };
        
        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'gathering') {
                this.onStatusUpdate('📡 Gathering network candidates...', 'info');
            } else if (pc.iceGatheringState === 'complete') {
                this.onStatusUpdate('✅ Finished gathering network candidates', 'success');
            }
        };
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const type = event.candidate.type;
                const messages = {
                    'host': '🏠 Found local network path',
                    'srflx': '🌐 Found public internet path (via STUN)',
                    'relay': '🔁 Found relay path (via TURN server)'
                };
                if (messages[type]) {
                    this.onStatusUpdate(messages[type], 'info');
                }
            } else {
                this.onStatusUpdate('✅ Finished discovering all connection paths', 'success');
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
