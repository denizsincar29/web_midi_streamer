/**
 * webrtc.js — Ultra-low-latency WebRTC P2P Mesh Manager
 *
 * Key enhancements over the baseline:
 *  • Experimental Low-Latency Mode: unordered, maxRetransmits:0 DataChannel
 *  • ICE candidate parser: detects Host/Srflx/Relay and IPv4/IPv6, reports to UI
 *  • IPv6 preference: non-IPv6 candidates filtered when disabled
 *  • Binary MIDI path: Uint8Array through DataChannel (no JSON overhead)
 *  • One-way latency estimation via performance.now() timestamps in binary packets
 */

import { MIDI_FRAME_VERSION } from './config.js';

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

// JSON message types that the app layer understands. Anything with a `type`
// outside this set is a protocol error and is dropped — never misread as MIDI.
const KNOWN_APP_TYPES = new Set(['hello', 'chat', 'settings_sync', 'role_change', 'test_note', 'midi']);

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

// ── WebRTCManager ─────────────────────────────────────────────────────────────

export class WebRTCManager {
    constructor(onMessage, onStatusUpdate, onICEPath, translate) {
        this.onMessage               = onMessage;
        this.onStatusUpdate          = onStatusUpdate;
        this.onICEPath               = onICEPath ?? (() => {});
        this._translate              = translate ?? null;   // i18n t() fn, injected by app
        this.onConnectionStateChange = null;
        this.onPeerCountChange       = null;
        this.onPeerConnect           = null;   // (peerId) => void — fired when DC opens
        this.onPeerDisconnect        = null;   // (peerId) => void — fired when peer leaves

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
    }

    // Translation helper — app passes t() from i18n.js; fallback returns the key as-is
    _t(key) {
        return this._translate ? this._translate(key) : key;
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
        this.onStatusUpdate(this._t('webrtc.connecting'), 'info');

        await this._wsOpen();
        this._send({ type: 'join', from: this.myId });
        this.onStatusUpdate(this._t('webrtc.waiting'), 'info', false);

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
        let sent = 0;
        for (const p of this.peers.values()) {
            if (p.isOpen()) {
                if (data instanceof Uint8Array) {
                    p.dataChannel.send(data);
                } else if (typeof data === 'string') {
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
            if (data instanceof Uint8Array) {
                p.dataChannel.send(data);
            } else if (typeof data === 'string') {
                p.dataChannel.send(data);
            } else {
                p.dataChannel.send(JSON.stringify(data));
            }
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
        this._stopHeartbeat();
        this.ws?.close(); this.ws = null;
        // Use _removePeer so all per-peer timers are cancelled cleanly
        for (const remoteId of [...this.peers.keys()]) this._removePeer(remoteId);
        this.myId = null;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        // Stop any running stability test
        if (this._stabTimer) { clearInterval(this._stabTimer); this._stabTimer = null; }
    }

    sendPing() {
        if (!this.isConnected()) { this.onStatusUpdate(this._t('webrtc.noConnections'), 'error'); return; }
        if (this.pingStats.inProgress) { this.onStatusUpdate(this._t('webrtc.pingBusy'), 'warning'); return; }
        this.pingStats = this._resetPing();
        const openPeers = [...this.peers.values()].filter(p => p.isOpen());
        this.pingStats.total = 5 * openPeers.length;
        this.pingStats.inProgress = true;
        this.onStatusUpdate(this._t('webrtc.pingStarted').replace('{n}', openPeers.length), 'info');
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
        this._stabGaps         = [];   // inter-arrival gaps recorded on remote side
        this._lastProbeArrival = null;  // reset so first gap isn't huge
        this._lastProbeSeq     = null;
        this._stabStart        = performance.now();
        this._stabDuration = durationMs;

        this._stabTimer = setInterval(() => {
            // Check duration first so we don't send one extra probe at the boundary
            if (performance.now() - this._stabStart >= durationMs) {
                this.stopStabilityTest();
                return;
            }
            if (!this.isConnected()) return;
            const seq = ++this._stabSeq;
            const ts  = performance.now();
            this._stabSent++;
            this.send(JSON.stringify({ type: 'stab_probe', seq, ts, interval: intervalMs }));
        }, intervalMs);

        this.onStatusUpdate(this._t('stability.started').replace('{interval}', intervalMs).replace('{duration}', durationMs/1000), 'info');
    }

    stopStabilityTest() {
        if (this._stabTimer) { clearInterval(this._stabTimer); this._stabTimer = null; }
        const gaps  = this._stabGaps ?? [];
        if (gaps.length < 2) { this.onStatusUpdate(this._t('stability.noData'), 'warning'); return; }
        const jitter = this._calcJitter(gaps);
        const lost   = this._stabLost ?? 0;
        const total  = this._stabSent ?? 0;
        const stable = jitter < (this._stabInterval * 0.2) && (lost / Math.max(total, 1)) < 0.05;
        this.onStatusUpdate(this._t('stability.result').replace('{jitter}', jitter.toFixed(1)).replace('{lost}', lost).replace('{total}', total).replace('{verdict}', stable ? this._t('stability.verdictStable') : this._t('stability.verdictUnstable')), stable ? 'success' : 'error');
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

    // ── WebSocket ─────────────────────────────────────────────────────────────

    _wsOpen() {
        return new Promise((resolve, reject) => {
            const url = SIGNALING_URL(this.roomName, this.myId);
            if (this.reconnectAttempts > 0) {
                console.log(`[WS] reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} → ${url}`);
            }
            const ws  = new WebSocket(url);
            this.ws   = ws;
            let settled = false;
            const settle = (fn, val) => { if (!settled) { settled = true; clearTimeout(timer); fn(val); } };
            const timer = setTimeout(() => {
                console.error(`[WS] timeout connecting to ${url}`);
                ws.close();
                settle(reject, new Error(`Signaling server timeout: ${url}`));
            }, 8000);
            ws.onopen    = () => { this.reconnectAttempts = 0; this._reconnectPending = false; this._startHeartbeat(); settle(resolve); };
            ws.onmessage = async ({ data }) => { try { await this._handleSignal(JSON.parse(data)); } catch(e){ console.error('[WS] signal parse error:', e); } };
            ws.onerror   = (e) => { console.error('[WS] error:', e); settle(reject, new Error('WebSocket error')); };
            ws.onclose   = (ev) => { this._stopHeartbeat(); if (!settled) settle(reject, new Error(`WS closed: ${ev.code}`)); if (!this.manualDisconnect) this._scheduleReconnect(); };
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
        if (this._reconnectPending) return;   // already scheduled — don't double-up
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatusUpdate(this._t('webrtc.signalFailed'), 'error'); return;
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, ++this.reconnectAttempts));
        this._reconnectPending = true;
        this.reconnectTimer = setTimeout(async () => {
            this._reconnectPending = false;
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
            const peer = this._getOrCreatePeer(msg.from, this._isPolite(msg.from));
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
            const peer = this._getOrCreatePeer(msg.from, this._isPolite(msg.from));
            const desc = msg.sdp;
            const collision = desc.type === 'offer' && (peer.makingOffer || peer.pc.signalingState !== 'stable');
            peer.ignoreOffer = !peer.isPolite && collision;
            if (peer.ignoreOffer) return;
            try {
                if (collision) {
                    // Polite side rolls back its own in-flight offer so the
                    // impolite peer's crossing offer can be accepted instead.
                    await peer.pc.setLocalDescription({ type: 'rollback' });
                }
                await peer.pc.setRemoteDescription(desc);
                for (const c of peer.pendingICE) { try { await peer.pc.addIceCandidate(c); } catch{} }
                peer.pendingICE = [];
                if (desc.type === 'offer') {
                    await peer.pc.setLocalDescription();
                    this._send({ type:'sdp', from:this.myId, to:msg.from, sdp:peer.pc.localDescription });
                }
            } catch(e) {
                if (!peer.ignoreOffer) console.error('sdp handling:', e);
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
            if (peer.makingOffer) return;   // an offer is already in flight
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

        // ── connectionState is more reliable than iceConnectionState for
        // deciding whether to tear down (covers DTLS failures too).
        pc.onconnectionstatechange = () => {
            const s = pc.connectionState;
            console.log(`[PC] ${remoteId.slice(0,6)} → ${s}`);

            if (s === 'connected') {
                if (peer._watchdogTimer) { clearTimeout(peer._watchdogTimer); peer._watchdogTimer = null; }
                // Only report path / chime on first connect, not on ICE restart recovery
                if (!peer._everConnected) {
                    peer._everConnected = true;
                    this._reportPath(pc, remoteId, peer);
                } else {
                    // Silent recovery — just update the badge
                    this._reportPath(pc, remoteId, peer, /*silent=*/true);
                }
                peer._iceRestartCount = 0;
            }

            if (s === 'disconnected') {
                // Transient — start a watchdog but do NOT chime or restart ICE.
                // The browser self-recovers from 'disconnected' most of the time.
                console.log(`[PC] ${remoteId.slice(0,6)} temporarily disconnected — watching…`);
                if (peer._watchdogTimer) return;
                peer._watchdogTimer = setTimeout(() => {
                    peer._watchdogTimer = null;
                    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                        // Still gone after 20 s — treat as failed
                        this.onStatusUpdate(this._t('webrtc.lostAfter20s').replace('{peer}', remoteId.slice(0,6)), 'warning', false);
                        this._removePeer(remoteId);
                    }
                }, 20000);
            }

            if (s === 'failed') {
                if (peer._watchdogTimer) { clearTimeout(peer._watchdogTimer); peer._watchdogTimer = null; }
                peer._iceRestartCount = (peer._iceRestartCount ?? 0) + 1;
                // Per spec: only the IMPOLITE peer initiates ICE restart.
                // Polite peer waits for the re-offer triggered by the other side.
                if (!peer.isPolite && peer._iceRestartCount <= 2) {
                    this.onStatusUpdate(this._t('webrtc.reconnecting').replace('{peer}', remoteId.slice(0,6)).replace('{n}', peer._iceRestartCount), 'warning', false);
                    try { pc.restartIce(); }
                    catch(e) {
                        this.onStatusUpdate(this._t('webrtc.connectionLost').replace('{peer}', remoteId.slice(0,6)), 'error');
                        this._removePeer(remoteId);
                    }
                } else if (peer.isPolite) {
                    // Polite side: wait up to 8 s for impolite peer to send re-offer
                    if (!peer._failedWaitTimer) {
                        peer._failedWaitTimer = setTimeout(() => {
                            peer._failedWaitTimer = null;
                            if (pc.connectionState === 'failed') {
                                this.onStatusUpdate(this._t('webrtc.connectionLost').replace('{peer}', remoteId.slice(0,6)), 'error');
                                this._removePeer(remoteId);
                            }
                        }, 8000);
                    }
                } else {
                    this.onStatusUpdate(this._t('webrtc.connectionLost').replace('{peer}', remoteId.slice(0,6)), 'error');
                    this._removePeer(remoteId);
                }
            }

            if (s === 'closed') {
                this._removePeer(remoteId);
            }
        };

        // Keep iceConnectionState only for console diagnostics — no side effects
        pc.oniceconnectionstatechange = () => {
            console.log(`[ICE] ${remoteId.slice(0,6)} → ${pc.iceConnectionState}`);
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
            const mode = this.lowLatencyMode ? this._t('webrtc.connectedMode') : '';
            this.onStatusUpdate(this._t('webrtc.connected').replace('{peer}', peer.remoteId.slice(0,6)).replace('{mode}', mode).replace('{n}', n).replace('{plural}', n>1?'s':''), 'success');
            this.onConnectionStateChange?.(true);
            this.onPeerCountChange?.(n);
            this.onPeerConnect?.(peer.remoteId);   // app sends 'hello' here
            setTimeout(() => this._quickPing(peer), 800);
        };
        dc.onmessage = ({ data }) => this._handleData(data, peer.remoteId);
        dc.onclose   = () => { peer.connected = false; /* pc.onconnectionstatechange('closed') handles full cleanup */ };
        dc.onerror   = e  => this.onStatusUpdate(this._t('webrtc.dcError').replace('{error}', e), 'error');
    }

    _removePeer(remoteId) {
        const peer = this.peers.get(remoteId);
        if (!peer) return;
        // Clear all pending timers before tearing down
        if (peer._iceRestartTimer)  { clearTimeout(peer._iceRestartTimer);  peer._iceRestartTimer  = null; }
        if (peer._watchdogTimer)    { clearTimeout(peer._watchdogTimer);    peer._watchdogTimer    = null; }
        if (peer._failedWaitTimer)  { clearTimeout(peer._failedWaitTimer);  peer._failedWaitTimer  = null; }
        peer.dataChannel?.close();
        peer.pc?.close();
        this.peers.delete(remoteId);
        const n = this.connectedCount();
        this.onStatusUpdate(this._t('webrtc.peerLeft').replace('{peer}', remoteId.slice(0,6)).replace('{n}', n), 'info', false);
        this.onConnectionStateChange?.(n > 0);
        this.onPeerCountChange?.(n);
        this.onPeerDisconnect?.(remoteId);   // let app update participants panel
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

    _reportPath(pc, remoteId, peer, silent = false) {
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

                    // Always log to console; only add to message panel on first connect
                    console.log(`[Path] ${typeLabel} (${ipVer}) → ${remoteId.slice(0,6)}`);
                    if (!silent) {
                        this.onStatusUpdate(`${typeLabel} (${ipVer}) → ${remoteId.slice(0,6)}`, 'success', false); // path type label not translated (always technical)
                    }

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

    // Deterministic polite/impolite assignment so exactly one peer per pair is
    // polite. This prevents both sides from ignoring each other's crossing offers.
    _isPolite(remoteId) {
        return this.myId < remoteId;
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
            this.onStatusUpdate(this._t('webrtc.pingResult').replace('{id}', msg.pingId).replace('{rtt}', rtt.toFixed(1)).replace('{oneway}', (rtt/2).toFixed(1)), 'success', false);
            if (this.pingStats.times.length >= this.pingStats.total && this.pingStats.inProgress) {
                const avg = this.pingStats.times.reduce((a,b)=>a+b,0)/this.pingStats.times.length;
                this.pingStats.lastAvg = avg;
                this.pingStats.inProgress = false;
                const mn = Math.min(...this.pingStats.times), mx = Math.max(...this.pingStats.times);
                this.onStatusUpdate(this._t('webrtc.pingDone').replace('{min}', mn.toFixed(1)).replace('{avg}', avg.toFixed(1)).replace('{max}', mx.toFixed(1)).replace('{oneway}', (avg/2).toFixed(1)), 'success');
            }
            return;
        }

        // Typed application message — forward only known types. Anything else
        // is a protocol error and is dropped, never misread as MIDI.
        if (typeof msg.type === 'string') {
            if (KNOWN_APP_TYPES.has(msg.type)) {
                this.onMessage({ type: msg.type, data: msg.data ?? msg, from: fromId });
            } else {
                console.warn('[RTC] dropping unknown message type:', msg.type);
            }
            return;
        }

        // No `type` field — legacy JSON MIDI payload (`{ data, timestamp }`).
        // New senders always set an explicit `type:'midi'`; this path keeps
        // older clients interoperable until everyone is on the current build.
        if (msg.data !== undefined) {
            this.onMessage({ type: 'midi', data: msg, from: fromId });
        } else {
            console.warn('[RTC] dropping unrecognised JSON message:', raw);
        }
    }

    /**
     * Decode compact binary MIDI packet produced by midi-worker.js.
     *
     * Layout (current):
     *   byte 0      protocol version (MIDI_FRAME_VERSION)
     *   byte 1      flags  (bit 0 = has timestamp)
     *   bytes 2-9   Float64 timestamp big-endian — only if flag set
     *   remaining   raw MIDI bytes
     *
     * Legacy frames from older clients had no version byte — byte 0 was the
     * flags. Flags only ever set bit 0, so byte values 0x00/0x01 are
     * unambiguous and decode correctly on both paths.
     */
    _handleBinaryPacket(bytes, fromId) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (view.byteLength < 1) return;

        const first = view.getUint8(0);
        let flags, tsOffset;
        if (first === MIDI_FRAME_VERSION) {
            if (view.byteLength < 2) return;
            flags    = view.getUint8(1);
            tsOffset = 2;
        } else if (first === 0x00 || first === 0x01) {
            flags    = first;            // legacy frame: byte 0 was the flags
            tsOffset = 1;
        } else {
            console.warn(`[MIDI binary] unknown frame version 0x${first.toString(16)} — dropping`);
            return;
        }

        const hasTs      = (flags & 0x01) !== 0;
        const dataOffset = tsOffset + (hasTs ? 8 : 0);
        if (view.byteLength < dataOffset) return;
        const midiBytes = bytes.slice(dataOffset);

        let timestamp = null;
        if (hasTs) {
            timestamp = view.getFloat64(tsOffset, false);
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
