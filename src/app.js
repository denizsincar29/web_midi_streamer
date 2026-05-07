import { getRoomNameFromURL, copyToClipboard } from './utils.js';
import { MIDIManager } from './midi.js';
import { UIManager } from './ui.js';
import { WebRTCManager } from './webrtc.js';
import { RoomManager } from './rooms.js';
import { t, setLanguage, getCurrentLanguage, getAvailableLanguages } from './i18n.js';

export class MIDIStreamer {
    constructor() {
        this.roomName = getRoomNameFromURL();
        this.settings = {
            sysexEnabled: false,
            timestampEnabled: false,
            showMidiActivity: false,
            midiEchoEnabled: false,
            ipv6Enabled: true
        };
        this.isUpdatingFromRemote = false;
        this.MAX_TIMESTAMP_DELAY_MS = 10000;

        this.midi = new MIDIManager();
        this.ui = new UIManager(this.midi);
        this.webrtc = new WebRTCManager(
            (msg) => this.handleWebRTCMessage(msg),
            (text, type) => this.ui.addMessage(text, type)
        );

        this.roomManager = new RoomManager(location.hostname);
        this.webrtc.ipv6Enabled = this.settings.ipv6Enabled;
        this.roomRefreshIntervalId = null;
        this.currentRoomName = '';

        this.webrtc.onConnectionStateChange = (connected) => {
            this.ui.updateButtonStates(true, connected);
            this.ui.enableChat(connected);
            if (connected) {
                this.midi.playStatusChime('peer_connection');
                this.ui.updateConnectionStatus(t('status.connectedToPeer'), 'connected');
            }
        };

        this.init();
    }

    async init() {
        this.initI18n();
        this.setupEventListeners();
        document.getElementById('ipv6Enabled').checked = this.settings.ipv6Enabled;

        const roomNameInput = document.getElementById('roomNameInput');
        if (this.roomName && roomNameInput) {
            roomNameInput.value = this.roomName;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('forceTurn') === 'true') {
            this.ui.addMessage(t('warning.turnRelay'), 'warning');
        }

        window.addEventListener('beforeunload', () => {
            this.midi.allNotesOff();
            this.disconnect();
        });

        try {
            await this.midi.init();
            this.ui.addMessage(t('midi.accessGranted'), 'success');
            this.midi.refreshDevices();
        } catch (error) {
            this.ui.addMessage(`${t('midi.accessFailed')}: ${error.message}`, 'error');
        }

        this.midi.onMessage = (data) => this.handleMIDIInput(data);

        if (this.roomName) {
            this.ui.updateRoomName(`${t('status.title')} ${this.roomName}`);
            this.ui.addMessage(`${t('connection.autoConnecting')} '${this.roomName}'...`, 'info');
            this.connect();
        } else {
            this.ui.updateRoomName(t('status.enterRoomName'));
            this.ui.addMessage(t('connection.enterAndConnect'), 'info');
        }
    }

    initI18n() {
        const languageSelect = document.getElementById('languageSelect');
        languageSelect.value = getCurrentLanguage();

        languageSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
            this.updatePageTranslations();
            document.documentElement.lang = e.target.value;
        });

        this.updatePageTranslations();
        document.documentElement.lang = getCurrentLanguage();
    }

    updatePageTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = t(key);
        });

        this.updateDynamicTranslations();
    }

    updateDynamicTranslations() {
        if (!this.webrtc.isConnected() && !this.roomName) {
            this.ui.updateRoomName(t('status.enterRoomName'));
        }

        if (this.webrtc.peerConnection) {
            const state = this.webrtc.peerConnection.connectionState;
            if (state === 'connected') {
                this.ui.updateConnectionStatus(t('status.connectedToPeer'), 'connected');
            } else if (state === 'connecting') {
                this.ui.updateConnectionStatus(t('status.waitingForPeer'), 'connecting');
            } else {
                this.ui.updateConnectionStatus(t('status.disconnected'), 'disconnected');
            }
        } else {
            this.ui.updateConnectionStatus(t('status.disconnected'), 'disconnected');
        }

        const shareSection = document.getElementById('shareUrlSection');
        if (shareSection) {
            const label = shareSection.querySelector('p');
            if (label) label.textContent = t('connection.shareUrl');
            const copyBtn = shareSection.querySelector('button');
            if (copyBtn) copyBtn.textContent = t('connection.copyUrl');
        }
    }

    setupEventListeners() {
        document.getElementById('sysexEnabled').addEventListener('change', (e) => {
            this.settings.sysexEnabled = e.target.checked;
            this.ui.addMessage(e.target.checked ? t('settings.sysexEnabledMsg') : t('settings.sysexDisabledMsg'), 'info');
        });

        document.getElementById('timestampEnabled').addEventListener('change', (e) => {
            this.settings.timestampEnabled = e.target.checked;
            this.ui.addMessage(e.target.checked ? t('settings.timestampEnabledMsg') : t('settings.timestampDisabledMsg'), 'info');

            if (!this.isUpdatingFromRemote && this.webrtc && this.webrtc.isConnected()) {
                this.webrtc.send({ type: 'settings_sync', data: { timestampEnabled: e.target.checked } });
            }
        });

        document.getElementById('showMidiActivity').addEventListener('change', (e) => {
            this.settings.showMidiActivity = e.target.checked;
            this.ui.toggleMidiActivity(e.target.checked);
            this.ui.addMessage(e.target.checked ? t('settings.midiActivityEnabledMsg') : t('settings.midiActivityDisabledMsg'), 'info');
        });

        document.getElementById('midiInput').addEventListener('change', (e) => {
            this.midi.selectInput(e.target.value);
        });

        document.getElementById('midiOutput').addEventListener('change', (e) => {
            this.midi.selectOutput(e.target.value);
        });

        document.getElementById('refreshDevices').addEventListener('click', () => {
            this.midi.refreshDevices();
            this.ui.addMessage(t('midi.devicesRefreshed'), 'info');
        });

        const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
        if (refreshRoomsBtn) refreshRoomsBtn.addEventListener('click', () => this.refreshAvailableRooms());

        const helpBtn = document.getElementById('helpBtn');
        helpBtn.addEventListener('click', () => {
            const currentLang = getCurrentLanguage();
            const helpPage = currentLang === 'ru' ? 'help-ru.html' : 'help-en.html';
            const currentUrl = window.location.href;
            window.location.href = `${helpPage}?return=${encodeURIComponent(currentUrl)}`;
        });

        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
        document.getElementById('sendTestNoteBtn').addEventListener('click', () => this.sendTestNote());
        document.getElementById('sendPingBtn').addEventListener('click', () => this.webrtc.sendPing());

        document.getElementById('midiEchoEnabled').addEventListener('change', (e) => {
            this.settings.midiEchoEnabled = e.target.checked;
            this.ui.addMessage(e.target.checked ? t('settings.midiEchoEnabledMsg') : t('settings.midiEchoDisabledMsg'), 'info');
        });

        document.getElementById('ipv6Enabled').addEventListener('change', (e) => {
            this.settings.ipv6Enabled = e.target.checked;
            this.ui.addMessage(e.target.checked ? t('settings.ipv6EnabledMsg') : t('settings.ipv6DisabledMsg'), 'info');
            if (this.webrtc) this.webrtc.ipv6Enabled = e.target.checked;
        });

        this.ui.onSendChat = (message) => {
            if (this.webrtc.isConnected()) {
                this.webrtc.send({ type: 'chat', data: message });
                this.ui.addChatMessage(message, 'you');
            } else {
                this.ui.addMessage(t('chat.notConnected'), 'error');
            }
        };
    }

    async refreshAvailableRooms() {
        if (this.webrtc.isConnected()) {
            this.setRoomsVisibility(false);
            return;
        }

        try {
            const rooms = await this.roomManager.fetchRooms();
            const visibleRooms = rooms.filter((room) => room.name !== this.currentRoomName);
            this.roomManager.displayRooms(visibleRooms, (roomName) => {
                const roomNameInput = document.getElementById('roomNameInput');
                if (roomNameInput) {
                    roomNameInput.value = roomName;
                }
                this.connect();
            }, {
                excludedRoomName: this.currentRoomName,
                announceRoom: (roomName, peerCount) => {
                    const countText = peerCount === 1 ? t('rooms.peerCount_singular') : t('rooms.peerCount_plural').replace('{n}', peerCount);
                    this.ui.announceStatus(t('rooms.newRoomAvailable').replace('{room}', roomName).replace('{count}', countText));
                }
            });
            this.setRoomsVisibility(true);
        } catch (err) {
            console.error('Failed to refresh rooms:', err);
            this.ui.addMessage(t('rooms.refreshFailed') || 'Failed to refresh rooms', 'error');
        }
    }

    startRoomAutoRefresh(intervalMs = 5000) {
        return intervalMs;
    }

    stopRoomAutoRefresh() {
        if (!this.roomRefreshIntervalId) return;
        clearInterval(this.roomRefreshIntervalId);
        this.roomRefreshIntervalId = null;
    }

    async connect() {
        try {
            const roomNameInput = document.getElementById('roomNameInput');
            if (!roomNameInput) { this.ui.addMessage(t('connection.roomInputNotFound'), 'error'); return; }
            const roomName = roomNameInput.value.trim();
            if (!roomName) { this.ui.addMessage(t('connection.enterRoomNamePrompt'), 'error'); return; }
            const shareUrl = await this.webrtc.connect(roomName);
            if (shareUrl) {
                this.currentRoomName = roomName;
                this.ui.updateRoomName(`${t('status.title')} ${roomName}`);
                this.ui.addMessage(`${t('connection.connectedToRoom')} '${roomName}'`, 'success');
                this.ui.addMessage(`${t('connection.shareUrl')} ${shareUrl}`, 'info');
                this.midi.playStatusChime('room_connection');
                this.setRoomsVisibility(false);
                this.ui.displayShareableUrl(shareUrl, (url) => {
                    copyToClipboard(url).then(() => this.ui.addMessage(t('connection.urlCopied'), 'success'))
                        .catch(() => this.ui.addMessage(t('connection.copyUrlFailed'), 'error'));
                });
            }
            this.ui.updateConnectionStatus(t('status.waitingForPeer'), 'connecting');
            this.ui.updateButtonStates(true, false);
        } catch (error) {
            this.ui.addMessage(`${t('connection.failed')}: ${error.message}`, 'error');
        }
    }

    disconnect() {
        this.midi.allNotesOff();
        this.webrtc.disconnect();
        this.ui.addMessage(t('status.disconnected'), 'info');
        this.ui.updateConnectionStatus(t('status.disconnected'), 'disconnected');
        this.ui.updateButtonStates(false, false);
        this.ui.enableChat(false);
        this.webrtc.manualDisconnect = false;
        this.currentRoomName = '';
        this.setRoomsVisibility(true);
        this.midi.refreshDevices();
        this.refreshAvailableRooms();
    }

    setRoomsVisibility(visible) {
        const section = document.querySelector('.available-rooms');
        if (section) {
            section.hidden = !visible;
        }
    }

    handleMIDIInput(data) {
        if (!this.settings.sysexEnabled && data[0] === 0xF0) return;
        const message = this.settings.timestampEnabled ? { data, timestamp: performance.now() } : { data };
        this.webrtc.send(message);
        this.midi.announceMIDIEvent(data, this.settings.showMidiActivity);
    }

    handleWebRTCMessage(msg) {
        if (msg.type === 'test_note') {
            this.ui.addMessage(`${t('debug.receivedTestNote') || 'Received test note via WebRTC:'} ${msg.data}`, 'success');
            this.midi.send(msg.data);
        } else if (msg.type === 'settings_sync') {
            if (msg.data.timestampEnabled !== undefined) {
                this.isUpdatingFromRemote = true;
                this.settings.timestampEnabled = msg.data.timestampEnabled;
                document.getElementById('timestampEnabled').checked = msg.data.timestampEnabled;
                this.ui.addMessage(msg.data.timestampEnabled ? t('settings.timestampEnabledByRemote') : t('settings.timestampDisabledByRemote'), 'info');
                this.isUpdatingFromRemote = false;
            }
        } else if (msg.type === 'midi') {
            const { data, timestamp } = msg.data;
            if (timestamp && this.settings.timestampEnabled) {
                const now = performance.now();
                const rawDelay = now - timestamp;
                const estimatedLatency = this.webrtc.getEstimatedLatency();
                const processingDelay = rawDelay - estimatedLatency;
                if (rawDelay >= 0 && rawDelay < this.MAX_TIMESTAMP_DELAY_MS) {
                    if (estimatedLatency > 0) {
                        if (processingDelay < 0) {
                            console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms, Network latency: ${estimatedLatency.toFixed(2)}ms (Note: latency estimate may be high)`);
                        } else {
                            console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms, Network latency: ${estimatedLatency.toFixed(2)}ms, Processing delay: ${processingDelay.toFixed(2)}ms`);
                        }
                    } else {
                        console.log(`MIDI message - Raw delay: ${rawDelay.toFixed(2)}ms (run ping test for latency compensation)`);
                    }
                }
            }
            this.midi.send(data);
            if (this.settings.midiEchoEnabled && this.webrtc.isConnected()) {
                const echoMessage = this.settings.timestampEnabled ? { data, timestamp: performance.now() } : { data };
                this.webrtc.send(echoMessage);
            }
        } else if (msg.type === 'chat') {
            this.ui.addChatMessage(msg.data, 'peer');
        }
    }

    sendTestNote() {
        if (!this.webrtc.isConnected()) {
            this.ui.addMessage(t('debug.pingNotOpen'), 'error');
            return;
        }
        const noteOnData = [0x90, 60, 100];
        this.webrtc.send({ type: 'test_note', data: noteOnData });
        this.ui.addMessage(t('debug.sentTestNote'), 'info');
        setTimeout(() => {
            const noteOffData = [0x80, 60, 0];
            this.webrtc.send({ type: 'test_note', data: noteOffData });
        }, 500);
    }
}

export default MIDIStreamer;
