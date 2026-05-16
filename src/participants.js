/**
 * participants.js — Peer roster management.
 *
 * Tracks every remote peer that has connected:
 *   • peerId   — internal WebRTC peer ID (short hash)
 *   • nickname — display name chosen by that peer
 *   • role     — 'player' | 'listener'
 *   • color    — one of PEER_COLORS, assigned in join order
 *   • latency  — last RTT/2 from ping, or null
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
        this._peers    = new Map();   // peerId → { nickname, role, color, latency }
        this._colorIdx = 0;
        this._myNick   = myNickname || 'You';
        this._onUpdate = onUpdate ?? (() => {});
        this._container = document.getElementById('participantsList');
        this._panel     = document.getElementById('participantsSection');
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /** Called when a peer's hello message arrives. */
    add(peerId, nickname, role = 'player') {
        if (this._peers.has(peerId)) {
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
            });
        }
        this._render();
        this._onUpdate();
    }

    /** Called when a peer disconnects. */
    remove(peerId) {
        this._peers.delete(peerId);
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
        this._peers.clear();
        this._colorIdx = 0;
        this._render();
        this._onUpdate();
    }

    get peerCount() { return this._peers.size; }

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

        // Show/hide the section
        if (this._panel) {
            this._panel.hidden = this._peers.size === 0;
        }
    }

    _makeRow(peerId, nickname, role, info, isMe = false) {
        const row = document.createElement('div');
        row.className = 'participant-row' + (isMe ? ' participant-row--me' : '');

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
}
