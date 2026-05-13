/**
 * webrtc.js — Ultra-low-latency WebRTC P2P Mesh Manager
 *
 * Key enhancements over the baseline:
 *  • Experimental Low-Latency Mode: unordered, maxRetransmits:0 DataChannel
 *  • ICE candidate parser: detects Host/Srflx/Relay and IPv4/IPv6, reports to UI
 *  • IPv6 preference: non-IPv6 candidates filtered when disabled
 *  • Binary MIDI path: Uint8Array through DataChannel (no JSON overhead)
 *  • One-way latency estimation via performance.now() timestamps in binary packets
 *  • WebTransport skeleton (datagram mode) with graceful fallback to WebRTC
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

// ── ICE candidate analyser ─────────────────────────────────────────────────────

function analyseCandidate(candidate) {
    if (!candidate?.candidate) return null;
    const parts  = candidate.candidate.split(' ');
    const proto  = parts[2]?.toLowerCase() ?? 'unknown';
    const addr   = parts[4] ?? '';
    const type   = parts[7] ?? 'unknown';
    const ipVer  = addr.includes(':') ? 'IPv6' : 'IPv4';
    return { type, ipVersion: ipVer, address: addr, protocol: proto };
}

// ── PeerConn ───────────────────────────────────────────────────────────────────

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
        this.pathInfo    = null;
    }
    isOpen() { return this.dataChannel?.readyState === 'open'; }
}

// ── WebTransport skeleton ──────────────────────────────────────────────────────

/**
 * WebTransportRelay — skeleton for datagram-mode WebTransport.
 *
 * True browser-native WebTransport requires an HTTPS/3 server endpoint
 * (not direct P2P). For a real deployment you would run a QUIC relay (e.g.
 * using Go's quic-go library or Cloudflare Workers) and set webTransportUrl.
 *
 * Until a relay server exists this class self-reports as unavailable so the
 * manager falls back to WebRTC automatically.
 */
class WebTransportRelay {
    constructor(url) {
        this.url       = url;
        this.transport = null;
        this.writer    = null;
        this.available = false;
    }

    static isSupported() {
        return typeof WebTransport !== 'undefined';
    }

    async connect() {
        if (!WebTransportRelay.isSupported()) throw new Error('WebTransport not supported');
        if (!this.url) throw new Error('No WebTransport relay URL configured');
        this.transport = new WebTransport(this.url);
        await this.transport.ready;
        this.writer    = this.transport.datagrams.writable.getWriter();
        this.available = true;
        console.log('[WebTransport] Connected to relay:', this.url);
    }

    async send(uint8Array) {
        if (!this.writer) throw new Error('WebTransport not connected');
        await this.writer.write(uint8Array);
    }

    async *receive() {
        const reader = this.transport.datagrams.readable.getReader();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
    }

    close() {
        this.transport?.close();
        this.transport = null;
        this.writer    = null;
        this.available = false;
    }
}

// ── WebRTCManager ─────────────────────────────────────────────────────────────

export class WebRTCManager {
    constructor(onMessage, onStatusUpdate, onICEPath) {
        this.onMessage               = onMessage;
        this.onStatusUpdate          = onStatusUpdate;
        this.onICEPath               = onICEPath ?? (() => {});
        this.onConnectionStateChange = null;
        this.onPeerCountChange       = null;

        this.ws               = null;
        this.roomName         = null;
        this.myId             = null;
        this.peers            = new Map();
        this.manualDisconnect = false;
        this.ipv6Enabled      = true;
        this.lowLatencyMode   = false;   // Experimental Low-Latency Mode

        this.pingStats            = this._resetPing();
        this.reconnectAttempts    = 0;
        this.maxReconnectAttempts = 6;
        this.reconnectTimer       = null;

        // WebTransport (experimental)
        this.webTransportUrl = null;
        this._wt             = null;
        this.useWebTransport = false;
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

        // Try WebTransport if relay URL is configured
        if (this.webTransportUrl && WebTransportRelay.isSupported()) {
            try {
                this._wt = new WebTransportRelay(this.webTransportUrl);
                await this._wt.connect();
                this.useWebTransport = true;
                this.onStatusUpdate('⚡ WebTransport (QUIC datagram) active', 'success');
                this._startWebTransportReceiveLoop();
            } catch (err) {
                this.onStatusUpdate(`⚠️ WebTransport unavailable (${err.message}), falling back to WebRTC`, 'warning');
                this.useWebTransport = false;
                this._wt             = null;
            }
        }

        await this._wsOpen();
        this._send({ type: 'join', from: this.myId });
        this.onStatusUpdate('⏳ Waiting for other participants…', 'info');

        if (!this._visibilityBound) {
            this._visibilityBound = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !this.manualDisconnect) {
                    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                        this.reconnectAttempts = 0;
                        this._scheduleReconnect();
                    }
                }
            });
            window.addEventListener('online', () => {
                if (!this.manualDisconnect && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
                    this.reconnectAttempts = 0;
                    this._scheduleReconnect();
                }
            });
        }

        return `${location.origin}${location.pathname}?room=${encodeURIComponent(roomName)}`;
    }

    send(data) {
        if (this.useWebTransport && data instanceof Uint8Array) {
            this._wt?.send(data).catch(e => console.warn('WT send error:', e));
            return 1;
        }
        let sent = 0;
        for (const p of this.peers.values()) {
            if (p.isOpen()) {
                if (data instanceof Uint8Array) {
                    p.dataChannel.send(data);
                } else {
                    p.dataChannel.send(JSON.stringify(data));
                }
                sent++;
            }
        }
        return sent;
    }

    sendTo(remoteId, data) {
        const p = this.peers.get(remoteId);
        if (p?.isOpen()) {
            p.dataChannel.send(data instanceof Uint8Array ? data : JSON.stringify(data));
            return true;
        }
        return false;
    }

    isConnected() {
        if (this.useWebTransport) return true;
        for (const p of this.peers.values()) if (p.isOpen()) return true;
        return false;
    }

    connectedCount() {
        if (this.useWebTransport) return 1;
        let n = 0;
        for (const p of this.peers.values()) if (p.isOpen()) n++;
        return n;
    }

    async disconnect() {
        this.manualDisconnect = true;
        this._stopHeartbeat();
        this.ws?.close(); this.ws = null;
        for (const p of this.peers.values()) { p.dataChannel?.close(); p.pc?.close(); }
        this.peers.clear();
        this.myId = null;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this._wt?.close(); this._wt = null; this.useWebTransport = false;
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
                    if (!peer.isOpen()) return;
                    const id = `${peer.remoteId.slice(0,6)}-${i+1}`;
                    const ts = performance.now();
                    this.pingStats.sentTimes[id] = ts;
                    peer.dataChannel.send(JSON.stringify({ type:'ping', timestamp:ts, pingId:id }));
                }, i * 100);
            }
        });
    }

    getEstimatedLatency() { return this.pingStats.lastAvg / 2; }

    // ── Stability Test ─────────────────────────────────────────────────────────
    //
    // Fires a lightweight probe packet every `intervalMs` ms and records the
    // actual inter-arrival gap on the receiving side.  Jitter = stddev of gaps.
    // The onStabilityUpdate callback receives:
    //   { type: 'probe_result', gap, expected, jitter, lost, total, stable }

    startStabilityTest(intervalMs = 200, durationMs = 10000) {
        if (this._stabTimer) this.stopStabilityTest();

        this._stabInterval = intervalMs;
        this._stabSeq      = 0;
        this._stabSent     = 0;
        this._stabLost     = 0;
        this._stabGaps     = [];   // inter-arrival gaps recorded on remote side
        this._stabStart    = performance.now();
        this._stabDuration = durationMs;

        this._stabTimer = setInterval(() => {
            if (!this.isConnected()) return;
            const seq = ++this._stabSeq;
            const ts  = performance.now();
            this._stabSent++;
            this.send(JSON.stringify({ type: 'stab_probe', seq, ts, interval: intervalMs }));

            // Auto-stop after durationMs
            if (performance.now() - this._stabStart >= durationMs) {
                this.stopStabilityTest();
            }
        }, intervalMs);

        this.onStatusUpdate(`📶 Stability test started (${intervalMs} ms interval, ${durationMs/1000} s)`, 'info');
    }

    stopStabilityTest() {
        if (this._stabTimer) { clearInterval(this._stabTimer); this._stabTimer = null; }
        const gaps  = this._stabGaps ?? [];
        if (gaps.length < 2) { this.onStatusUpdate('Stability test stopped (not enough data)', 'warning'); return; }
        const jitter = this._calcJitter(gaps);
        const lost   = this._stabLost ?? 0;
        const total  = this._stabSent ?? 0;
        const stable = jitter < (this._stabInterval * 0.2) && (lost / Math.max(total, 1)) < 0.05;
        this.onStatusUpdate(
            `📶 Stability: jitter ${jitter.toFixed(1)} ms | loss ${lost}/${total} | ${stable ? '✅ STABLE' : '❌ UNSTABLE'}`,
            stable ? 'success' : 'error'
        );
        this.onStabilityUpdate?.({ type: 'test_done', jitter, lost, total, stable, gaps });
    }

    _calcJitter(gaps) {
        if (gaps.length < 2) return 0;
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
        return Math.sqrt(variance);
    }

    _handleStabProbe(msg, fromId) {
        const now = performance.now();
        // Track inter-arrival gap
        if (this._lastProbeArrival != null) {
            const gap = now - this._lastProbeArrival;
            const expected = msg.interval ?? 200;
            const jitter   = Math.abs(gap - expected);
            // Detect lost packets by sequence gap
            const seqDiff  = msg.seq - (this._lastProbeSeq ?? msg.seq - 1);
            const lost     = Math.max(0, seqDiff - 1);

            this.onStabilityUpdate?.({ type: 'probe_result', gap, expected, jitter, lost, seq: msg.seq });

            // Echo result back to sender so they can display it too
            this.sendTo(fromId, JSON.stringify({
                type: 'stab_result', seq: msg.seq, gap, jitter, lost,
                stable: jitter < expected * 0.2,
            }));
        }
        this._lastProbeArrival = now;
        this._lastProbeSeq     = msg.seq;
    }

    // ── WebTransport receive loop ─────────────────────────────────────────────

    async _startWebTransportReceiveLoop() {
        try {
            for await (const datagram of this._wt.receive()) {
                this._handleBinaryPacket(datagram, 'webtransport');
            }
        } catch (err) {
            if (!this.manualDisconnect) {
                this.onStatusUpdate(`⚠️ WebTransport receive error: ${err.message}`, 'warning');
            }
        }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    _wsOpen() {
        return new Promise((resolve, reject) => {
            const url = SIGNALING_URL(this.roomName, this.myId);
            const ws  = new WebSocket(url);
            this.ws   = ws;
            const timer = setTimeout(() => reject(new Error(`Cannot reach signaling server at ${url}`)), 8000);
            ws.onopen    = () => { clearTimeout(timer); this.reconnectAttempts = 0; this._startHeartbeat(); resolve(); };
            ws.onmessage = async ({ data }) => { try { await this._handleSignal(JSON.parse(data)); } catch(e){ console.error(e); } };
            ws.onerror   = () => { clearTimeout(timer); reject(new Error('WebSocket error')); };
            ws.onclose   = () => { this._stopHeartbeat(); if (!this.manualDisconnect) this._scheduleReconnect(); };
        });
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN)
                this.ws.send(JSON.stringify({ type: 'keepalive', from: this.myId }));
        }, 25_000);
    }

    _stopHeartbeat() {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
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
            iceServers:           DEFAULT_ICE_SERVERS,
            iceCandidatePoolSize: 4,
            bundlePolicy:         'max-bundle',
            rtcpMuxPolicy:        'require',
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

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;

            const info = analyseCandidate(candidate);

            // IPv6 filtering
            if (!this.ipv6Enabled && info?.ipVersion === 'IPv6') return;

            // Log to console with type + IP version
            if (info) {
                const typeLabels = { host:'🏠 Host', srflx:'🌐 STUN (srflx)', relay:'🔁 TURN (relay)' };
                const label = typeLabels[info.type] ?? info.type;
                console.log(`[ICE candidate] ${label} | ${info.ipVersion} | ${info.address} | ${info.protocol.toUpperCase()}`);
            }

            this._send({ type:'ice', from:this.myId, to:remoteId, candidate });
        };

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            if (s === 'failed')       { this.onStatusUpdate(`❌ ICE failed for ${remoteId.slice(0,6)}`, 'error'); this._removePeer(remoteId); }
            if (s === 'disconnected') { this.onStatusUpdate(`⚠️ Peer ${remoteId.slice(0,6)} disconnected`, 'warning'); }
            if (s === 'connected' || s === 'completed') this._reportPath(pc, remoteId, peer);
        };

        pc.ondatachannel = ({ channel }) => { peer.dataChannel = channel; this._setupDC(peer); };
        return peer;
    }

    _createDataChannel(peer) {
        // Low-Latency Mode: unordered + no retransmits = minimal queuing delay
        // Trade-off: occasional packet loss (acceptable for real-time MIDI).
        const dcOptions = this.lowLatencyMode
            ? { ordered: false, maxRetransmits: 0, priority: 'high' }
            : { ordered: true,  maxRetransmits: 2 };

        peer.dataChannel = peer.pc.createDataChannel('midi', dcOptions);
        this._setupDC(peer);
    }

    _setupDC(peer) {
        const dc = peer.dataChannel;
        dc.binaryType = 'arraybuffer';
        dc.onopen = () => {
            peer.connected = true;
            const n    = this.connectedCount();
            const mode = this.lowLatencyMode ? ' ⚡ Low-Latency' : '';
            this.onStatusUpdate(
                `✅ Connected to ${peer.remoteId.slice(0,6)}${mode} (${n} peer${n>1?'s':''} total)`,
                'success'
            );
            this.onConnectionStateChange?.(true);
            this.onPeerCountChange?.(n);
            setTimeout(() => this._quickPing(peer), 800);
        };
        dc.onmessage = ({ data }) => this._handleData(data, peer.remoteId);
        dc.onclose   = () => { peer.connected = false; this._removePeer(peer.remoteId); };
        dc.onerror   = e  => this.onStatusUpdate(`❌ DataChannel error: ${e}`, 'error');
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
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!peer.isOpen()) return;
                peer.dataChannel.send(JSON.stringify({
                    type:'ping', timestamp:performance.now(), pingId:`init-${peer.remoteId.slice(0,6)}-${i}`
                }));
            }, i * 100);
        }
    }

    _reportPath(pc, remoteId, peer) {
        pc.getStats().then(stats => {
            stats.forEach(r => {
                if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.nominated)) {
                    const lc = stats.get(r.localCandidateId);
                    const rc = stats.get(r.remoteCandidateId);
                    if (!lc) return;

                    const typeLabels  = { host:'🏠 Direct LAN', srflx:'🌐 STUN', relay:'🔁 TURN' };
                    const typeLabel   = typeLabels[lc.candidateType] ?? lc.candidateType;
                    const localAddr   = lc.address ?? lc.ip ?? '';
                    const remoteAddr  = rc?.address ?? rc?.ip ?? '';
                    const ipVer       = localAddr.includes(':') ? 'IPv6' : 'IPv4';

                    this.onStatusUpdate(`${typeLabel} (${ipVer}) → ${remoteId.slice(0,6)}`, 'success');

                    this.onICEPath({
                        candidateType: lc.candidateType,
                        ipVersion:     ipVer,
                        localAddress:  localAddr,
                        remoteAddress: remoteAddr,
                        peerId:        remoteId,
                    });

                    if (peer) peer.pathInfo = { candidateType: lc.candidateType, ipVersion: ipVer };
                }
            });
        }).catch(() => {});
    }

    // ── Data handler ───────────────────────────────────────────────────────────

    _handleData(raw, fromId) {
        if (raw instanceof ArrayBuffer || raw instanceof Uint8Array) {
            this._handleBinaryPacket(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw, fromId);
            return;
        }

        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'stab_probe') { this._handleStabProbe(msg, fromId); return; }
        if (msg.type === 'stab_result') {
            const g = this._stabGaps ?? (this._stabGaps = []);
            g.push(msg.gap);
            if (msg.lost) this._stabLost = (this._stabLost ?? 0) + msg.lost;
            this.onStabilityUpdate?.({ type: 'probe_result', ...msg });
            return;
        }

        if (msg.type === 'ping') {
            this.sendTo(fromId, JSON.stringify({ type:'pong', timestamp:msg.timestamp, pingId:msg.pingId }));
            return;
        }
        if (msg.type === 'pong') {
            const rtt = performance.now() - msg.timestamp;
            this.pingStats.count++;
            this.pingStats.times.push(rtt);
            this.onStatusUpdate(`Ping ${msg.pingId}: ${rtt.toFixed(1)} ms RTT (est. one-way: ${(rtt/2).toFixed(1)} ms)`, 'success');
            if (this.pingStats.times.length >= this.pingStats.total && this.pingStats.inProgress) {
                const avg = this.pingStats.times.reduce((a,b)=>a+b,0)/this.pingStats.times.length;
                this.pingStats.lastAvg = avg;
                this.pingStats.inProgress = false;
                const mn = Math.min(...this.pingStats.times), mx = Math.max(...this.pingStats.times);
                this.onStatusUpdate(
                    `Ping done — min ${mn.toFixed(1)}  avg ${avg.toFixed(1)}  max ${mx.toFixed(1)} ms  (est. one-way: ${(avg/2).toFixed(1)} ms)`,
                    'success'
                );
            }
            return;
        }

        const structured = ['test_note','settings_sync','chat'].includes(msg.type)
            ? { type:msg.type, data:msg.data, from:fromId }
            : { type:'midi', data:msg, from:fromId };
        this.onMessage(structured);
    }

    /**
     * Decode compact binary MIDI packet produced by midi-worker.js.
     *
     * Layout:
     *   byte 0      flags  (bit 0 = has timestamp)
     *   bytes 1-8   Float64 timestamp big-endian — only if flag set
     *   remaining   raw MIDI bytes
     */
    _handleBinaryPacket(bytes, fromId) {
        const view       = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const hasTs      = (view.getUint8(0) & 0x01) !== 0;
        const dataOffset = hasTs ? 9 : 1;
        const midiBytes  = bytes.slice(dataOffset);

        let timestamp = null;
        if (hasTs) {
            timestamp = view.getFloat64(1, false);
            const oneWay = performance.now() - timestamp;
            if (oneWay >= 0 && oneWay < 30000) {
                console.debug(`[MIDI binary] est. one-way latency: ${oneWay.toFixed(2)} ms`);
            }
        }

        this.onMessage({ type:'midi', data:{ data: Array.from(midiBytes), timestamp }, from:fromId });
    }

    _uid() {
        return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2))
            .replace(/-/g,'').slice(0,12);
    }
}
