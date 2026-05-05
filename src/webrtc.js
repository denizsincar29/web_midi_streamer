/**
 * WebRTC P2P Manager — 2026 Edition
 *
 * Signaling: custom WebSocket server (signaler binary, port 8765)
 *   ws://your-host:8765/signal?room=ROOM&peer=PEERID
 *
 * Protocol: plain JSON text frames.
 *   Each peer connects to the room endpoint.
 *   Every message sent is broadcast to all OTHER peers in the room.
 *   The server does zero parsing — just dumb fan-out.
 *
 * WebRTC: Perfect Negotiation pattern (RFC 8829 / W3C WebRTC 1.0)
 *   Trickle ICE, bundlePolicy=max-bundle, ordered DataChannel.
 */

// ── Configure your signaling server here ─────────────────────────────────────
// Change to wss:// if you put nginx/caddy in front with TLS (recommended).
const SIGNALING_HOST = location.hostname;        // same host as the web app
const SIGNALING_PROTO = location.protocol === 'https:' ? 'wss' : 'ws';
const SIGNALING_URL = (room, peer) =>
    `${SIGNALING_PROTO}://${SIGNALING_HOST}/signal?room=${encodeURIComponent(room)}&peer=${encodeURIComponent(peer)}`;

// ── Free public STUN servers ──────────────────────────────────────────────────
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
];

// ── Main WebRTC Manager ───────────────────────────────────────────────────────
export class WebRTCManager {
    constructor(onMessage, onStatusUpdate) {
        this.onMessage = onMessage;
        this.onStatusUpdate = onStatusUpdate;
        this.onConnectionStateChange = null;

        this.pc = null;
        this.dataChannel = null;
        this.ws = null;

        this.roomName = null;
        this.myId = null;
        this.remoteId = null;

        // Perfect Negotiation flags
        this.makingOffer = false;
        this.ignoreOffer = false;
        this.isPolite = true;

        this.pendingCandidates = [];
        this.hasConnection = false;
        this.manualDisconnect = false;
        this.pingStats = this._resetPing();
    }

    _resetPing() {
        return { count: 0, total: 0, times: [], sentTimes: {}, inProgress: false, lastAvg: 0 };
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async connect(roomName) {
        if (!roomName) throw new Error('Room name required');
        this.manualDisconnect = false;
        this.roomName = roomName;
        this.myId = this._uid();
        this.isPolite = true;

        this.onStatusUpdate('🔗 Connecting to signaling server…', 'info');
        await this._wsOpen();
        this._createPC();
        this._send({ type: 'join', from: this.myId });
        this.onStatusUpdate('⏳ Waiting for other participant…', 'info');

        return `${location.origin}${location.pathname}?room=${encodeURIComponent(roomName)}`;
    }

    send(data) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        }
        return false;
    }

    isConnected() { return this.dataChannel?.readyState === 'open'; }

    async disconnect() {
        this.manualDisconnect = true;
        this.hasConnection = false;
        this.ws?.close();
        this.ws = null;
        this.dataChannel?.close();
        this.pc?.close();
        this.dataChannel = null;
        this.pc = null;
        this.myId = null;
        this.remoteId = null;
        this.pendingCandidates = [];
    }

    sendPing() {
        if (!this.isConnected()) { this.onStatusUpdate('Data channel not open', 'error'); return; }
        if (this.pingStats.inProgress) { this.onStatusUpdate('Ping already in progress', 'warning'); return; }
        this.pingStats = this._resetPing();
        this.pingStats.total = 5;
        this.pingStats.inProgress = true;
        this.onStatusUpdate('Starting ping test (5 pings)…', 'info');
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const id = i + 1, ts = performance.now();
                this.pingStats.sentTimes[id] = ts;
                this.send({ type: 'ping', timestamp: ts, pingId: id });
            }, i * 100);
        }
    }

    getEstimatedLatency() { return this.pingStats.lastAvg / 2; }

    // ── WebSocket signaling ───────────────────────────────────────────────────

    _wsOpen() {
        return new Promise((resolve, reject) => {
            const url = SIGNALING_URL(this.roomName, this.myId);
            const ws = new WebSocket(url);
            this.ws = ws;

            const timer = setTimeout(() =>
                reject(new Error(`Cannot reach signaling server at ${url}`)), 8000);

            ws.onopen = () => {
                clearTimeout(timer);
                this.onStatusUpdate('✅ Signaling server connected', 'success');
                resolve();
            };

            ws.onmessage = async ({ data }) => {
                try {
                    const msg = JSON.parse(data);
                    await this._handleSignal(msg);
                } catch (e) { console.error('signal parse error:', e); }
            };

            ws.onerror = () => {
                clearTimeout(timer);
                reject(new Error(`WebSocket error — is the signaler running on port 443`));
            };

            ws.onclose = () => {
                if (!this.manualDisconnect)
                    this.onStatusUpdate('⚠️ Signaling disconnected', 'warning');
            };
        });
    }

    // Send a signaling message via WebSocket (broadcast to room peers by server)
    _send(obj) {
        if (this.ws?.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify(obj));
    }

    // ── RTCPeerConnection — Perfect Negotiation ───────────────────────────────

    _createPC() {
        const pc = new RTCPeerConnection({
            iceServers: DEFAULT_ICE_SERVERS,
            iceCandidatePoolSize: 4,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
        });
        this.pc = pc;

        // Perfect Negotiation: always ready to renegotiate
        pc.onnegotiationneeded = async () => {
            try {
                this.makingOffer = true;
                await pc.setLocalDescription();          // implicit createOffer/Answer
                this._send({ type: 'sdp', from: this.myId, sdp: pc.localDescription });
            } catch (e) { console.error('negotiationneeded:', e); }
            finally { this.makingOffer = false; }
        };

        // Trickle ICE — send each candidate immediately
        pc.onicecandidate = ({ candidate }) =>
            this._send({ type: 'ice', from: this.myId, candidate });

        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'gathering')
                this.onStatusUpdate('📡 Gathering ICE candidates…', 'info');
            else if (pc.iceGatheringState === 'complete')
                this.onStatusUpdate('✅ ICE gathering complete', 'success');
        };

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            const label = {
                checking:     '🔍 Checking connectivity…',
                connected:    '✅ Network path established',
                completed:    '✅ Connection stable',
                failed:       '❌ ICE failed — check firewall / TURN config',
                disconnected: '⚠️ Temporarily disconnected',
                closed:       '🔌 Connection closed',
            }[s];
            if (label) this.onStatusUpdate(label, s === 'failed' ? 'error' : 'info');
            if (s === 'connected' || s === 'completed') this._reportPath(pc);
        };

        // Non-initiator receives the DataChannel via this event
        pc.ondatachannel = ({ channel }) => {
            this.dataChannel = channel;
            this._setupDC();
        };
    }

    _reportPath(pc) {
        pc.getStats().then(stats => {
            stats.forEach(r => {
                if (r.type === 'candidate-pair' && r.state === 'succeeded') {
                    const lc = stats.get(r.localCandidateId);
                    if (lc) {
                        const labels = {
                            host:  '🏠 Direct LAN P2P',
                            srflx: '🌐 P2P via STUN (internet)',
                            relay: '🔁 TURN relay',
                        };
                        this.onStatusUpdate(
                            `${labels[lc.candidateType] || lc.candidateType} — path active`, 'success');
                    }
                }
            });
        }).catch(() => {});
    }

    _createDataChannel() {
        this.dataChannel = this.pc.createDataChannel('midi', {
            ordered: true,
            maxRetransmits: 2,      // low latency: don't retry forever
        });
        this._setupDC();
    }

    _setupDC() {
        const dc = this.dataChannel;
        dc.onopen = () => {
            this.hasConnection = true;
            this.onStatusUpdate('✅ P2P data channel open — streaming ready!', 'success');
            this.onConnectionStateChange?.(true);
            setTimeout(() => this.sendPing(), 800);
        };
        dc.onmessage = ({ data }) => this._handleData(data);
        dc.onclose = () => {
            this.hasConnection = false;
            this.onStatusUpdate('Peer disconnected', 'warning');
            this.onConnectionStateChange?.(false);
        };
        dc.onerror = e => this.onStatusUpdate(`❌ DataChannel error: ${e}`, 'error');
    }

    // ── Perfect Negotiation signal handler ────────────────────────────────────

    async _handleSignal(msg) {
        if (msg.from === this.myId) return;   // server echoes to others, but be safe

        if (!this.remoteId && msg.from) this.remoteId = msg.from;

        if (msg.type === 'join') {
            // We were here first → we are the impolite peer (offerer)
            this.remoteId = msg.from;
            this.isPolite = false;
            // Only the initiator creates the DataChannel — polite peer receives via ondatachannel
            this._createDataChannel();
            if (this.pc?.signalingState === 'stable') {
                try {
                    this.makingOffer = true;
                    await this.pc.setLocalDescription();
                    this._send({ type: 'sdp', from: this.myId, sdp: this.pc.localDescription });
                } catch (e) { console.error('join offer:', e); }
                finally { this.makingOffer = false; }
            }
            return;
        }

        if (msg.type === 'sdp') {
            const desc = msg.sdp;
            const collision = desc.type === 'offer' &&
                (this.makingOffer || this.pc.signalingState !== 'stable');
            this.ignoreOffer = !this.isPolite && collision;
            if (this.ignoreOffer) return;

            await this.pc.setRemoteDescription(desc);

            // Flush ICE candidates that arrived before the remote description
            for (const c of this.pendingCandidates) {
                try { await this.pc.addIceCandidate(c); } catch { /* ignore */ }
            }
            this.pendingCandidates = [];

            if (desc.type === 'offer') {
                await this.pc.setLocalDescription();
                this._send({ type: 'sdp', from: this.myId, sdp: this.pc.localDescription });
            }
            return;
        }

        if (msg.type === 'ice') {
            try {
                if (this.pc.remoteDescription) {
                    await this.pc.addIceCandidate(msg.candidate ?? null);
                } else if (msg.candidate) {
                    this.pendingCandidates.push(msg.candidate);
                }
            } catch (e) { if (!this.ignoreOffer) console.error('addIceCandidate:', e); }
        }
    }

    // ── DataChannel messages ──────────────────────────────────────────────────

    _handleData(raw) {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (msg.type === 'ping') {
            this.send({ type: 'pong', timestamp: msg.timestamp, pingId: msg.pingId });
        } else if (msg.type === 'pong') {
            const rtt = performance.now() - msg.timestamp;
            this.pingStats.count++;
            this.pingStats.times.push(rtt);
            this.onStatusUpdate(`Ping ${msg.pingId}/${this.pingStats.total}: ${rtt.toFixed(1)} ms`, 'success');
            if (this.pingStats.count >= this.pingStats.total) {
                const avg = this.pingStats.times.reduce((a, b) => a + b, 0) / this.pingStats.times.length;
                this.pingStats.lastAvg = avg;
                this.pingStats.inProgress = false;
                const mn = Math.min(...this.pingStats.times), mx = Math.max(...this.pingStats.times);
                this.onStatusUpdate(
                    `Ping done — min ${mn.toFixed(1)} ms  avg ${avg.toFixed(1)} ms  max ${mx.toFixed(1)} ms`,
                    'success');
            }
        } else {
            const structured = ['test_note', 'settings_sync', 'chat'].includes(msg.type)
                ? { type: msg.type, data: msg.data }
                : { type: 'midi', data: msg };
            this.onMessage(structured);
        }
    }

    _uid() {
        return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
            .replace(/-/g, '').slice(0, 12);
    }
}
