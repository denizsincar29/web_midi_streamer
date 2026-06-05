/**
 * participants.js — Peer roster management.
 *
 * Tracks every remote peer that has connected:
 *   • peerId   — internal WebRTC peer ID (short hash)
 *   • nickname — display name chosen by that peer
 *   • role     — 'player' | 'listener'
 *   • color    — one of PEER_COLORS, assigned in join order
 *   • latency  — last RTT/2 from ping, or null
 *   • playing  — true while the peer has an active note
 *
 * The module owns the Participants <details> panel in the DOM.
 * It renders a row per peer and also exposes the colour palette so
 * piano.js can use per-peer colours for multi-player note display.
 */

export const PEER_COLORS = [
    { name: 'amber',  css: '#ffb830', dark: '#cc8800' },
    { name: 'green',  css: '#4caf50', dark: '#2e7d32' },
    { name: 'pink',   css: '#e91e8c', dark: '#ad1264' },
    { name: 'teal',   css: '#00bcd4', dark: '#00838f' },
    { name: 'orange', css: '#ff5722', dark: '#bf360c' },
    { name: 'lime',   css: '#8bc34a', dark: '#558b2f' },
];

export class ParticipantsManager {
    /**
     * @param {string} myNickname   — resolved from the nickname input at connect time
     * @param {Function} onUpdate  — called with no args whenever roster changes
     */
    constructor(myNickname, onUpdate) {
        this._peers    = new Map();   // peerId → { nickname, role, color, latency, playing }
        this._colorIdx = 0;
        this._myNick   = myNickname || 'You';
        this._onUpdate = onUpdate ?? (() => {});
        this._container = document.getElementById('participantsList');
        this._panel     = document.getElementById('participantsSection');
        this._announcer = document.getElementById('participantAnnouncer');
        this._myPlaying = false;
        // Debounce timers for playing state (per peer)
        this._playingTimers = new Map();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /** Called when a peer's hello message arrives. */
    add(peerId, nickname, role = 'player') {
        const isNew = !this._peers.has(peerId);
        if (!isNew) {
            // Update existing (e.g. nickname or role change)
            const p = this._peers.get(peerId);
            p.nickname = nickname || this._fallbackName(peerId);
            p.role     = role;
        } else {
            const color = PEER_COLORS[this._colorIdx % PEER_COLORS.length];
            this._colorIdx++;
            this._peers.set(peerId, {
                nickname: nickname || this._fallbackName(peerId),
                role,
                color,
                latency: null,
                playing: false,
            });
            // Announce join via screen reader
            this._announce((nickname || this._fallbackName(peerId)) + ' joined the room');
        }
        this._render();
        this._onUpdate();
    }

    /** Called when a peer disconnects. */
    remove(peerId) {
        const info = this._peers.get(peerId);
        if (info) {
            this._announce(info.nickname + ' left the room');
        }
        this._peers.delete(peerId);
        if (this._playingTimers.has(peerId)) {
            clearTimeout(this._playingTimers.get(peerId));
            this._playingTimers.delete(peerId);
        }
        this._render();
        this._onUpdate();
    }

    /** Called with each ping result to update the latency column. */
    updateLatency(peerId, latencyMs) {
        const p = this._peers.get(peerId);
        if (p) { p.latency = latencyMs; this._render(); }
    }

    /** Update our own displayed nickname (e.g. after the user edits it). */
    setMyNickname(name) {
        this._myNick = name || 'You';
        this._render();
    }

    /** Returns the full peer info object for a peerId, or null if not found. */
    get(peerId) {
        return this._peers.get(peerId) ?? null;
    }

    /** Returns the color object for a peerId, or null if not found. */
    colorFor(peerId) {
        return this._peers.get(peerId)?.color ?? null;
    }

    /** Returns role for a peerId, or null. */
    roleFor(peerId) {
        return this._peers.get(peerId)?.role ?? null;
    }

    /** Clear all peers (on disconnect). */
    clear() {
        for (const tid of this._playingTimers.values()) clearTimeout(tid);
        this._playingTimers.clear();
        this._peers.clear();
        this._colorIdx = 0;
        this._render();
        this._onUpdate();
    }

    get peerCount() { return this._peers.size; }

    /**
     * Mark a peer as actively playing (has notes on).
     * Auto-clears after 2 s of silence (debounced).
     * Does NOT announce via screen reader.
     */
    setPeerPlaying(peerId, playing) {
        const p = this._peers.get(peerId);
        if (!p) return;

        if (this._playingTimers.has(peerId)) {
            clearTimeout(this._playingTimers.get(peerId));
            this._playingTimers.delete(peerId);
        }

        if (playing) {
            p.playing = true;
            this._render();
            // Auto-clear after 2 s of no further note-on events
            const tid = setTimeout(() => {
                const peer = this._peers.get(peerId);
                if (peer) { peer.playing = false; this._render(); }
                this._playingTimers.delete(peerId);
            }, 2000);
            this._playingTimers.set(peerId, tid);
        } else {
            p.playing = false;
            this._render();
        }
    }

    /** Mark "me" as playing (local note activity). */
    setMePlaying(playing) {
        if (playing === this._myPlaying) return;
        this._myPlaying = playing;
        if (playing) {
            if (this._playingTimers.has('__me')) clearTimeout(this._playingTimers.get('__me'));
            const tid = setTimeout(() => {
                this._myPlaying = false;
                this._render();
                this._playingTimers.delete('__me');
            }, 2000);
            this._playingTimers.set('__me', tid);
        }
        this._render();
    }

    // ── Rendering ──────────────────────────────────────────────────────────────

    _render() {
        if (!this._container) return;
        this._container.innerHTML = '';

        // "You" row — always first
        this._container.appendChild(this._makeRow(null, this._myNick, 'player', null, true));

        for (const [peerId, info] of this._peers) {
            this._container.appendChild(
                this._makeRow(peerId, info.nickname, info.role, info)
            );
        }

    }

    _makeRow(peerId, nickname, role, info, isMe = false) {
        const row = document.createElement('li');
        row.className = 'participant-row' + (isMe ? ' participant-row--me' : '');
        const isPlaying = isMe ? this._myPlaying : info?.playing;
        if (isPlaying) row.classList.add('participant-row--playing');

        const parts = [nickname + (isMe ? ' (you)' : '')];
        parts.push(role === 'listener' ? 'listener' : 'player');
        if (isPlaying) parts.push('playing');
        if (!isMe && info?.latency != null) parts.push(Math.round(info.latency) + ' ms latency');
        row.setAttribute('aria-label', parts.join(', '));

        // Colour swatch
        const swatch = document.createElement('span');
        swatch.className = 'participant-swatch';
        swatch.setAttribute('aria-hidden', 'true');
        if (isMe) {
            swatch.style.background = '#4a9eff';
        } else if (info?.color) {
            swatch.style.background = info.color.css;
        }
        row.appendChild(swatch);

        // Name
        const name = document.createElement('span');
        name.className = 'participant-name';
        name.textContent = nickname + (isMe ? ' (you)' : '');
        row.appendChild(name);

        // Playing indicator (visual only, no SR)
        if (isPlaying) {
            const playing = document.createElement('span');
            playing.className = 'participant-playing';
            playing.setAttribute('aria-hidden', 'true');
            playing.textContent = '🎵';
            playing.title = 'Playing';
            row.appendChild(playing);
        }

        // Role badge
        if (!isMe) {
            const roleBadge = document.createElement('span');
            roleBadge.className = 'participant-role participant-role--' + role;
            roleBadge.textContent = role === 'listener' ? '👂' : '🎹';
            roleBadge.title = role === 'listener' ? 'Listener' : 'Player';
            row.appendChild(roleBadge);
        }

        // Latency
        if (!isMe && info?.latency != null) {
            const lat = document.createElement('span');
            lat.className = 'participant-latency';
            lat.textContent = Math.round(info.latency) + ' ms';
            row.appendChild(lat);
        }

        return row;
    }

    _fallbackName(peerId) {
        return 'Peer ' + peerId.slice(0, 6);
    }

    /** Announce text via the dedicated SR-only live region. */
    _announce(text) {
        if (!this._announcer) return;
        // Double-rAF: first frame clears, second frame sets.
        // Required for NVDA/JAWS to re-announce identical consecutive messages.
        this._announcer.textContent = '';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._announcer.textContent = text;
            });
        });
    }
}

// Standalone helper added after class definition
ParticipantsManager.prototype.showPanel = function(visible) {
    if (this._panel) this._panel.hidden = !visible;
};
