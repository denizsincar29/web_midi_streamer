import { t } from './i18n.js';

/**
 * Room Management Module
 * Handles fetching available rooms from the signaler and displaying them.
 *
 * Rooms are shown in two places simultaneously:
 *   - a <datalist> so the room input gets native autocomplete
 *   - a <ul role="listbox"> for screen-reader-friendly room picking
 *
 * Clicking a room item fills the room input. If a nickname is already saved the
 * caller's onRoomClick handler is invoked immediately (it should call connect()).
 * If no nickname exists yet, we only fill the input and focus the nickname field
 * — the user then types their name and hits the single "Join Room" button.
 */

export class RoomManager {
    constructor(signalerHost) {
        this.signalerHost  = signalerHost;
        this.signalerProto = location.protocol === 'https:' ? 'https' : 'http';
        this.rooms         = [];
        this.isLoading     = false;
        this.lastRoomNames = new Set();
    }

    getSignalerUrl() {
        return `${this.signalerProto}://${this.signalerHost}`;
    }

    async fetchRooms() {
        if (this.isLoading) return [];
        this.isLoading = true;
        try {
            const res = await fetch(`${this.getSignalerUrl()}/rooms`, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' },
            });
            if (!res.ok) { console.error('fetchRooms HTTP', res.status); return []; }
            const data = await res.json();
            this.rooms = Array.isArray(data) ? data : [];
            this.rooms.sort((a, b) => b.peerCount - a.peerCount);
            return this.rooms;
        } catch (err) {
            console.error('fetchRooms error:', err);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Render rooms into the listbox + datalist.
     *
     * @param {Array}    rooms        - array of {name, peerCount}
     * @param {Function} onRoomClick  - called with roomName when user picks a room
     *                                  AND already has a nickname saved
     * @param {Object}   options
     *   - excludedRoomName {string}  - current room to hide from list
     *   - announceRoom {Function}    - called for newly appeared rooms
     */
    displayRooms(rooms, onRoomClick, options = {}) {
        const listbox     = document.getElementById('roomsList');
        const datalist    = document.getElementById('roomSuggestions');
        const roomsStatus = document.getElementById('roomsStatus');
        const roomInput   = document.getElementById('roomNameInput');
        const nickInput   = document.getElementById('nicknameInput');
        const connectBtn  = document.getElementById('connectBtn');

        if (!listbox) return;

        const { excludedRoomName = '', announceRoom = null } = options;
        const visible = (rooms || []).filter(r => r?.name && r.name !== excludedRoomName);

        // ── datalist (native autocomplete) ────────────────────────────────────
        if (datalist) {
            datalist.innerHTML = '';
            visible.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.name;
                datalist.appendChild(opt);
            });
        }

        // ── status line ───────────────────────────────────────────────────────
        if (roomsStatus) {
            if (!visible.length) {
                roomsStatus.textContent = t('rooms.noActive');
                roomsStatus.className = 'rooms-status empty';
            } else {
                roomsStatus.textContent = visible.length === 1
                    ? t('rooms.availableCount_singular')
                    : t('rooms.availableCount_plural').replace('{n}', visible.length);
                roomsStatus.className = 'rooms-status';
            }
        }

        // ── listbox ───────────────────────────────────────────────────────────
        listbox.innerHTML = '';

        visible.forEach(room => {
            const li = document.createElement('li');
            li.className = 'room-item';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.tabIndex = 0;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'room-name';
            nameSpan.textContent = room.name;

            const countSpan = document.createElement('span');
            countSpan.className = 'room-peer-count';
            countSpan.textContent = room.peerCount === 1
                ? t('rooms.peerCount_singular')
                : t('rooms.peerCount_plural').replace('{n}', room.peerCount);

            li.appendChild(nameSpan);
            li.appendChild(countSpan);

            const pick = () => {
                // Fill the room input
                if (roomInput) roomInput.value = room.name;
                // Update connect button label to reflect existing room
                this._updateConnectBtn(connectBtn, room.name, visible);
                // Mark selection
                listbox.querySelectorAll('[aria-selected="true"]')
                    .forEach(el => el.setAttribute('aria-selected', 'false'));
                li.setAttribute('aria-selected', 'true');

                const hasNick = nickInput?.value?.trim()
                    || localStorage.getItem('midi_nickname');

                if (hasNick) {
                    onRoomClick?.(room.name);
                } else {
                    // No nick yet — guide the user: focus nickname, don't connect yet
                    nickInput?.focus();
                    if (roomsStatus) {
                        roomsStatus.textContent = t('participants.nicknameRequired');
                        roomsStatus.className = 'rooms-status info';
                    }
                }
            };

            li.addEventListener('click', pick);
            li.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
            });

            listbox.appendChild(li);

            if (announceRoom && this.lastRoomNames.size > 0 && !this.lastRoomNames.has(room.name)) {
                announceRoom(room.name, room.peerCount ?? 0);
            }
        });

        this.lastRoomNames = new Set(visible.map(r => r.name));

        // Update button label whenever room input changes
        if (roomInput && connectBtn && !roomInput._roomLabelListenerAttached) {
            roomInput._roomLabelListenerAttached = true;
            roomInput.addEventListener('input', () => {
                this._updateConnectBtn(connectBtn, roomInput.value.trim(), visible);
            });
        }
    }

    /**
     * Set the connect button label to "Join Room" if the typed name matches an
     * existing room, or "Create & Join" if it's a new name.
     */
    _updateConnectBtn(btn, typedName, visibleRooms) {
        if (!btn) return;
        const exists = visibleRooms.some(r => r.name === typedName);
        btn.setAttribute('data-i18n', exists ? 'connection.connectBtn' : 'connection.createBtn');
        btn.textContent = exists ? t('connection.connectBtn') : t('connection.createBtn');
    }
}
