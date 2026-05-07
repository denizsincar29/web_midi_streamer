import { t } from './i18n.js';

/**
 * Room Management Module
 * Handles fetching available rooms from the signaler and displaying them
 */

export class RoomManager {
    constructor(signalerHost) {
        this.signalerHost = signalerHost;
        this.signalerProto = location.protocol === 'https:' ? 'https' : 'http';
        this.rooms = [];
        this.isLoading = false;
    }

    /**
     * Get the base URL for the signaler
     */
    getSignalerUrl() {
        return `${this.signalerProto}://${this.signalerHost}`;
    }

    /**
     * Fetch available rooms from the signaler
     */
    async fetchRooms() {
        if (this.isLoading) return [];
        
        this.isLoading = true;
        try {
            const response = await fetch(`${this.getSignalerUrl()}/rooms`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                console.error('Failed to fetch rooms:', response.status);
                return [];
            }

            const data = await response.json();
            this.rooms = Array.isArray(data) ? data : [];
            
            // Sort rooms by peer count (descending)
            this.rooms.sort((a, b) => b.peerCount - a.peerCount);
            
            return this.rooms;
        } catch (error) {
            console.error('Error fetching rooms:', error);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Display rooms in the UI
     */
    displayRooms(rooms, onRoomClick) {
        const roomsList = document.getElementById('roomsList');
        const roomsStatus = document.getElementById('roomsStatus');

        if (!roomsList) return;

        roomsList.innerHTML = '';

        if (!rooms || rooms.length === 0) {
            roomsStatus.textContent = t('rooms.noActive');
            roomsStatus.className = 'rooms-status empty';
            return;
        }

        if (rooms.length === 1) {
            roomsStatus.textContent = t('rooms.availableCount_singular');
        } else {
            roomsStatus.textContent = t('rooms.availableCount_plural').replace('{n}', rooms.length);
        }
        roomsStatus.className = 'rooms-status';

        const ul = document.createElement('ul');
        ul.className = 'rooms-items';

        rooms.forEach((room) => {
            const li = document.createElement('li');
            li.className = 'room-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'room-name';
            nameSpan.textContent = room.name;

            const peerCountSpan = document.createElement('span');
            peerCountSpan.className = 'room-peer-count';
            if (room.peerCount === 1) {
                peerCountSpan.textContent = t('rooms.peerCount_singular');
            } else {
                peerCountSpan.textContent = t('rooms.peerCount_plural').replace('{n}', room.peerCount);
            }

            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-secondary btn-small';
            joinBtn.textContent = t('rooms.join');
            joinBtn.setAttribute('aria-label', `${t('rooms.join')} ${room.name}`);
            joinBtn.addEventListener('click', () => {
                if (onRoomClick) {
                    onRoomClick(room.name);
                }
            });

            li.appendChild(nameSpan);
            li.appendChild(peerCountSpan);
            li.appendChild(joinBtn);
            ul.appendChild(li);
        });

        roomsList.appendChild(ul);
    }
}
