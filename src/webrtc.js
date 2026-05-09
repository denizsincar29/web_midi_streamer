/**
 * WebRTC P2P Mesh Manager — multi-peer edition
 *
 * Every peer maintains a direct DataChannel to every other peer (full mesh).
 * Signaling uses unicast `to` fields so messages are only processed by the
 * intended recipient (the server still broadcasts everything, peers filter).
 */

const SIGNALING_HOST  = location.hostname;
const SIGNALING_PROTO = location.protocol === 'https:' ? 'wss' : 'ws';
const SIGNALING_URL   = (room, peer) =>
    `${SIGNALING_PROTO}://${SIGNALING_HOST}/signal?room=${encodeURIComponent(room)}&peer=${encodeURIComponent(peer)}`;

const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
];

class PeerConn {
    constructor(remoteId) {
        this.remoteId    = remoteId;
        this.pc          = null;
        this.dataChannel = null;
        this.makingOffer = false;
        this.ignoreOffer = false;
        this.isPolite    = true;
        this.pendingICE  = [];
        this.connected   = false;
    }
    isOpen() { return this.dataChannel?.readyState === 'open'; }
}

export class WebRTCManager {
    constructor(onMessage, onStatusUpdate) {
        this.onMessage               = onMessage;
        this.onStatusUpdate          = onStatusUpdate;
        this.onConnectionStateChange = null;
        this.onPeerCountChange       = null;

        this.ws               = null;
        this.roomName         = null;
        this.myId             = null;
        this.peers            = new Map();
        this.manualDisconnect = false;
        this.ipv6Enabled      = true;

        this.pingStats           = this._resetPing();
        this.reconnectAttempts   = 0;
        this.maxReconnectAttempts = 6;
        this.reconnectTimer      = null;
    }

    _resetPing() {
        return { count:0, total:0, times:[], sentTimes:{}, inProgress:false, lastAvg:0 };
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    async connect(roomName) {
        if (!roomName) throw new Error('Room name required');
        this.manualDisconnect = false;
        this.roomName = roomName;
        this.myId     = this._uid();
        this.onStatusUpdate('🔗 Connecting to signaling server…', 'info');
        await this._wsOpen();
        this._send({ type: 'join', from: this.myId });
        this.onStatusUpdate('⏳ Waiting for other participants…', 'info');
        return `${location.origin}${location.pathname}?room=${encodeURIComponent(roomName)}`;
    }

    send(data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        let sent = 0;
        for (const p of this.peers.values()) {
            if (p.isOpen()) { p.dataChannel.send(payload); sent++; }
        }
        return sent;
    }

    sendTo(remoteId, data) {
        const p = this.peers.get(remoteId);
        if (p?.isOpen()) {
            p.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        }
        return false;
    }

    isConnected() {
        for (const p of this.peers.values()) if (p.isOpen()) return true;
        return false;
    }

    connectedCount() {
        let n = 0;
        for (const p of this.peers.values()) if (p.isOpen()) n++;
        return n;
    }

    async disconnect() {
        this.manualDisconnect = true;
        this.ws?.close(); this.ws = null;
        for (const p of this.peers.values()) { p.dataChannel?.close(); p.pc?.close(); }
        this.peers.clear();
        this.myId = null;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    }

    sendPing() {
        if (!this.isConnected()) { this.onStatusUpdate('No open peer connections', 'error'); return; }
        if (this.pingStats.inProgress) { this.onStatusUpdate('Ping already in progress', 'warning'); return; }
        this.pingStats = this._resetPing();
        const openPeers = [...this.peers.values()].filter(p => p.isOpen());
        this.pingStats.total = 5 * openPeers.length;
        this.pingStats.inProgress = true;
        this.onStatusUpdate(`Starting ping test (5 pings × ${openPeers.length} peer(s))…`, 'info');
        openPeers.forEach(peer => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const id = `${peer.remoteId.slice(0,6)}-${i+1}`;
                    const ts = performance.now();
                    this.pingStats.sentTimes[id] = ts;
                    peer.dataChannel.send(JSON.stringify({ type:'ping', timestamp:ts, pingId:id }));
                }, i * 100);
            }
        });
    }

    getEstimatedLatency() { return this.pingStats.lastAvg / 2; }

    // ── WebSocket ──────────────────────────────────────────────────────────────

    _wsOpen() {
        return new Promise((resolve, reject) => {
            const url = SIGNALING_URL(this.roomName, this.myId);
            const ws  = new WebSocket(url);
            this.ws   = ws;
            const timer = setTimeout(() => reject(new Error(`Cannot reach signaling server at ${url}`)), 8000);
            ws.onopen    = () => { clearTimeout(timer); this.reconnectAttempts = 0; resolve(); };
            ws.onmessage = async ({ data }) => { try { await this._handleSignal(JSON.parse(data)); } catch(e){ console.error(e); } };
            ws.onerror   = () => { clearTimeout(timer); reject(new Error('WebSocket error')); };
            ws.onclose   = () => { if (!this.manualDisconnect) this._scheduleReconnect(); };
        });
    }

    _scheduleReconnect() {
        if (this.manualDisconnect) return;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatusUpdate('Unable to reconnect to signaling server', 'error'); return;
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, ++this.reconnectAttempts));
        this.reconnectTimer = setTimeout(async () => {
            try { await this._wsOpen(); this._send({ type:'join', from:this.myId }); }
            catch { this._scheduleReconnect(); }
        }, delay);
    }

    _send(obj) {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
    }

    // ── Signal handling ────────────────────────────────────────────────────────

    async _handleSignal(msg) {
        if (msg.from === this.myId) return;
        if (msg.to && msg.to !== this.myId) return;

        if (msg.type === 'join') {
            const peer = this._getOrCreatePeer(msg.from, false);
            peer.isPolite = false;
            this._createDataChannel(peer);
            try {
                peer.makingOffer = true;
                await peer.pc.setLocalDescription();
                this._send({ type:'sdp', from:this.myId, to:msg.from, sdp:peer.pc.localDescription });
            } catch(e){ console.error('join offer:', e); }
            finally { peer.makingOffer = false; }
            return;
        }

        if (msg.type === 'sdp') {
            const peer = this._getOrCreatePeer(msg.from, true);
            const desc = msg.sdp;
            const collision = desc.type === 'offer' && (peer.makingOffer || peer.pc.signalingState !== 'stable');
            peer.ignoreOffer = !peer.isPolite && collision;
            if (peer.ignoreOffer) return;
            await peer.pc.setRemoteDescription(desc);
            for (const c of peer.pendingICE) { try { await peer.pc.addIceCandidate(c); } catch{} }
            peer.pendingICE = [];
            if (desc.type === 'offer') {
                await peer.pc.setLocalDescription();
                this._send({ type:'sdp', from:this.myId, to:msg.from, sdp:peer.pc.localDescription });
            }
            return;
        }

        if (msg.type === 'ice') {
            const peer = this.peers.get(msg.from);
            if (!peer) return;
            try {
                if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(msg.candidate ?? null);
                else if (msg.candidate) peer.pendingICE.push(msg.candidate);
            } catch(e){ if (!peer.ignoreOffer) console.error('addIceCandidate:', e); }
        }
    }

    // ── PeerConnection ─────────────────────────────────────────────────────────

    _getOrCreatePeer(remoteId, polite) {
        if (this.peers.has(remoteId)) return this.peers.get(remoteId);
        const peer = new PeerConn(remoteId);
        peer.isPolite = polite;
        this.peers.set(remoteId, peer);

        const pc = new RTCPeerConnection({
            iceServers: DEFAULT_ICE_SERVERS,
            iceCandidatePoolSize: 4,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
        });
        peer.pc = pc;

        pc.onnegotiationneeded = async () => {
            try {
                peer.makingOffer = true;
                await pc.setLocalDescription();
                this._send({ type:'sdp', from:this.myId, to:remoteId, sdp:pc.localDescription });
            } catch(e){ console.error('negotiation:', e); }
            finally { peer.makingOffer = false; }
        };

        pc.onicecandidate = ({ candidate }) =>
            this._send({ type:'ice', from:this.myId, to:remoteId, candidate });

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            if (s === 'failed') { this.onStatusUpdate(`❌ ICE failed for ${remoteId.slice(0,6)}`, 'error'); this._removePeer(remoteId); }
            if (s === 'disconnected') this.onStatusUpdate(`⚠️ Peer ${remoteId.slice(0,6)} disconnected`, 'warning');
            if (s === 'connected' || s === 'completed') this._reportPath(pc, remoteId);
        };

        pc.ondatachannel = ({ channel }) => { peer.dataChannel = channel; this._setupDC(peer); };
        return peer;
    }

    _createDataChannel(peer) {
        peer.dataChannel = peer.pc.createDataChannel('midi', { ordered:true, maxRetransmits:2 });
        this._setupDC(peer);
    }

    _setupDC(peer) {
        const dc = peer.dataChannel;
        dc.onopen = () => {
            peer.connected = true;
            const n = this.connectedCount();
            this.onStatusUpdate(`✅ Connected to ${peer.remoteId.slice(0,6)} (${n} peer${n>1?'s':''} total)`, 'success');
            this.onConnectionStateChange?.(true);
            this.onPeerCountChange?.(n);
            setTimeout(() => this._quickPing(peer), 800);
        };
        dc.onmessage = ({ data }) => this._handleData(data, peer.remoteId);
        dc.onclose = () => { peer.connected = false; this._removePeer(peer.remoteId); };
        dc.onerror = e => this.onStatusUpdate(`❌ DataChannel error: ${e}`, 'error');
    }

    _removePeer(remoteId) {
        const peer = this.peers.get(remoteId);
        if (!peer) return;
        peer.dataChannel?.close();
        peer.pc?.close();
        this.peers.delete(remoteId);
        const n = this.connectedCount();
        this.onStatusUpdate(`Peer ${remoteId.slice(0,6)} left (${n} remaining)`, 'warning');
        this.onConnectionStateChange?.(n > 0);
        this.onPeerCountChange?.(n);
    }

    _quickPing(peer) {
        if (!peer.isOpen()) return;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!peer.isOpen()) return;
                peer.dataChannel.send(JSON.stringify({
                    type:'ping', timestamp:performance.now(), pingId:`init-${peer.remoteId.slice(0,6)}-${i}`
                }));
            }, i * 100);
        }
    }

    _reportPath(pc, remoteId) {
        pc.getStats().then(stats => {
            stats.forEach(r => {
                if (r.type === 'candidate-pair' && r.state === 'succeeded') {
                    const lc = stats.get(r.localCandidateId);
                    if (lc) {
                        const labels = { host:'🏠 Direct LAN', srflx:'🌐 STUN', relay:'🔁 TURN' };
                        this.onStatusUpdate(`${labels[lc.candidateType]||lc.candidateType} → ${remoteId.slice(0,6)}`, 'success');
                    }
                }
            });
        }).catch(()=>{});
    }

    // ── Data handler ───────────────────────────────────────────────────────────

    _handleData(raw, fromId) {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (msg.type === 'ping') {
            this.sendTo(fromId, { type:'pong', timestamp:msg.timestamp, pingId:msg.pingId });
            return;
        }
        if (msg.type === 'pong') {
            const rtt = performance.now() - msg.timestamp;
            this.pingStats.count++;
            this.pingStats.times.push(rtt);
            this.onStatusUpdate(`Ping ${msg.pingId}: ${rtt.toFixed(1)} ms`, 'success');
            if (this.pingStats.times.length >= this.pingStats.total && this.pingStats.inProgress) {
                const avg = this.pingStats.times.reduce((a,b)=>a+b,0)/this.pingStats.times.length;
                this.pingStats.lastAvg = avg;
                this.pingStats.inProgress = false;
                const mn = Math.min(...this.pingStats.times), mx = Math.max(...this.pingStats.times);
                this.onStatusUpdate(`Ping done — min ${mn.toFixed(1)} avg ${avg.toFixed(1)} max ${mx.toFixed(1)} ms`, 'success');
            }
            return;
        }
        const structured = ['test_note','settings_sync','chat'].includes(msg.type)
            ? { type:msg.type, data:msg.data, from:fromId }
            : { type:'midi', data:msg, from:fromId };
        this.onMessage(structured);
    }

    _uid() {
        return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
            .replace(/-/g,'').slice(0,12);
    }
}
