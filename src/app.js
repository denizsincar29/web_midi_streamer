import { getRoomNameFromURL, copyToClipboard } from './utils.js';
import { MIDIManager } from './midi.js';
import { UIManager } from './ui.js';
import { WebRTCManager } from './webrtc.js';
import { RoomManager } from './rooms.js';
import { MIDIRecorder } from './recorder.js';
import { t, setLanguage, getCurrentLanguage, getAvailableLanguages } from './i18n.js';
import { PianoKeyboard } from './piano.js';

export class MIDIStreamer {
    constructor() {
        this.roomName = getRoomNameFromURL();
        this.settings = {
            sysexEnabled: false,
            timestampEnabled: false,
            showMidiActivity: false,
            midiEchoEnabled: false,
            ipv6Enabled: true,
            lowLatencyMode: false,
        };
        this.isUpdatingFromRemote = false;
        this.MAX_TIMESTAMP_DELAY_MS = 10000;

        this.recorder        = new MIDIRecorder();
        this.currentTake     = null;
        this.playbackHandle  = null;
        this.roomHidden      = false;

        // ── Web Worker (off-main-thread MIDI serialisation) ────────────────
        this._midiWorker = null;
        this._initMidiWorker();

        // ── Stuck Note Prevention ─────────────────────────────────────────
        // Map<pitch, timeoutId> — one entry per active (Note On) pitch
        this._activeNotes = new Map();
        this.STUCK_NOTE_TIMEOUT_MS = 10_000;

        // Piano keyboard visualiser (created after DOM ready)
        this._piano = null;

        // Stability test state
        this._stabGaps = [];
        this._stabLost = 0;
        this._stabSent = 0;

        this.midi = new MIDIManager();
        this.ui = new UIManager(this.midi);
        this.webrtc = new WebRTCManager(
            (msg) => this.handleWebRTCMessage(msg),
            (text, type, announce) => this.ui.addMessage(text, type, announce),
            (pathInfo) => this._updateIPVersionBadge(pathInfo),
            t   // pass i18n translate function so webrtc.js can localise its messages
        );

        this.roomManager = new RoomManager(location.hostname);
        this.webrtc.ipv6Enabled = this.settings.ipv6Enabled;
        this.roomRefreshIntervalId = null;
        this.currentRoomName = '';

        this.webrtc.onConnectionStateChange = (connected) => {
            this.ui.updateButtonStates(true, connected);
            this.ui.enableChat(connected);
            this._onConnectionChange(connected);   // piano + stability buttons
            if (connected) {
                this.stopRoomAutoRefresh();
                this.midi.playStatusChime('peer_connection');
                const n = this.webrtc.connectedCount();
                this.ui.updateConnectionStatus(`Connected (${n} peer${n>1?'s':''})`, 'connected');
            } else {
                this.startRoomAutoRefresh();
                this.ui.updateConnectionStatus(t('status.disconnected'), 'disconnected');
            }
        };

        this.webrtc.onPeerCountChange = (n) => {
            const el = document.getElementById('peerCountBadge');
            if (el) el.textContent = n > 0 ? `${n} peer${n>1?'s':''}` : '';
            if (n > 0) {
                this.ui.updateConnectionStatus(`Connected (${n} peer${n>1?'s':''})`, 'connected');
            }
        };

        this.init();
    }

    async init() {
        this.initI18n();
        this.setupEventListeners();
        this.startRoomAutoRefresh();
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

        // Piano keyboard visualiser
        try {
            this._piano = new PianoKeyboard('#pianoContainer');
        } catch (e) { console.warn('Piano keyboard init failed:', e); }

        // Wire stability test callbacks
        this.webrtc.onStabilityUpdate = (ev) => this._onStabilityUpdate(ev);

        // Stability test buttons
        const stabStart = document.getElementById('stabStartBtn');
        const stabStop  = document.getElementById('stabStopBtn');
        if (stabStart) stabStart.addEventListener('click', () => this._startStabilityTest());
        if (stabStop)  stabStop.addEventListener('click',  () => this._stopStabilityTest());

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

        // Use the mesh's actual connection state rather than a non-existent .peerConnection
        if (this.webrtc.isConnected()) {
            const n = this.webrtc.connectedCount();
            this.ui.updateConnectionStatus(`Connected (${n} peer${n>1?'s':''})`, 'connected');
        } else if (this.currentRoomName) {
            this.ui.updateConnectionStatus(t('status.waitingForPeer'), 'connecting');
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

        // Experimental Low-Latency Mode toggle
        const llmToggle = document.getElementById('lowLatencyMode');
        if (llmToggle) {
            llmToggle.addEventListener('change', (e) => {
                this.settings.lowLatencyMode = e.target.checked;
                if (this.webrtc) this.webrtc.lowLatencyMode = e.target.checked;
                this.ui.addMessage(
                    e.target.checked ? t('settings.lowLatencyOn') : t('settings.lowLatencyOff'),
                    'info'
                );
            });
        }

        // Emergency All Notes Off
        const emergencyBtn = document.getElementById('emergencyAllNotesOff');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => this.emergencyAllNotesOff());
        }

        this.ui.onSendChat = (message) => {
            if (this.webrtc.isConnected()) {
                this.webrtc.send({ type: 'chat', data: message });
                this.ui.addChatMessage(message, 'you');
            } else {
                this.ui.addMessage(t('chat.notConnected'), 'error');
            }
        };

        // ── MIDI Recorder ──────────────────────────────────────────────────────
        const recBtn      = document.getElementById('recStartBtn');
        const recStopBtn  = document.getElementById('recStopBtn');
        const recPlayBtn  = document.getElementById('recPlayBtn');
        const recSaveBtn  = document.getElementById('recSaveBtn');
        const recStatus   = document.getElementById('recStatus');

        this.recorder.onStateChange = (recording) => {
            if (recBtn)     recBtn.disabled     = recording;
            if (recStopBtn) recStopBtn.disabled  = !recording;
            if (recStatus)  recStatus.textContent = recording ? '⏺ Recording…' : (this.currentTake ? '✅ Take ready' : '');
        };

        recBtn?.addEventListener('click', () => {
            this.currentTake    = null;
            this.playbackHandle?.cancel();
            this.playbackHandle = null;
            if (recPlayBtn) recPlayBtn.disabled = true;
            if (recSaveBtn) recSaveBtn.disabled = true;
            this.recorder.start();
            this.ui.addMessage(t('recorder.started'), 'info');
        });

        recStopBtn?.addEventListener('click', () => {
            this.currentTake = this.recorder.stop();
            if (!this.currentTake || this.currentTake.events.length === 0) {
                this.ui.addMessage(t('recorder.stoppedEmpty'), 'warning');
                return;
            }
            const dur = (this.currentTake.durationMs / 1000).toFixed(1);
            if (recPlayBtn) recPlayBtn.disabled = false;
            if (recSaveBtn) recSaveBtn.disabled = false;
            if (recStatus)  recStatus.textContent = `✅ Take: ${this.currentTake.events.length} events, ${dur}s`;
            this.ui.addMessage(t('recorder.stopped').replace('{events}', this.currentTake.events.length).replace('{dur}', dur), 'success');
        });

        recPlayBtn?.addEventListener('click', () => {
            if (!this.currentTake) return;
            this.playbackHandle?.cancel();
            this.ui.addMessage(t('recorder.playing'), 'info');
            this.playbackHandle = MIDIRecorder.playback(
                this.currentTake.events,
                (data) => this.midi.send(data),
                () => this.ui.addMessage(t('recorder.playbackDone'), 'success')
            );
        });

        recSaveBtn?.addEventListener('click', () => {
            if (!this.currentTake) return;
            const json = MIDIRecorder.exportJSON(this.currentTake);
            const blob = new Blob([json], { type: 'application/json' });
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = `midi-take-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            this.ui.addMessage(t('recorder.saved'), 'success');
        });

        // ── Hide room button ───────────────────────────────────────────────────
        const hideRoomBtn = document.getElementById('hideRoomBtn');
        hideRoomBtn?.addEventListener('click', () => this.toggleRoomHidden());
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
            this.ui.addMessage(t('rooms.refreshFailed'), 'error');
        }
    }

    startRoomAutoRefresh(intervalMs = 5000) {
        if (this.roomRefreshIntervalId) {
            clearInterval(this.roomRefreshIntervalId);
            this.roomRefreshIntervalId = null;
        }

        if (this.webrtc.isConnected()) {
            return;
        }

        this.refreshAvailableRooms();
        this.roomRefreshIntervalId = setInterval(() => {
            if (!this.webrtc.isConnected()) {
                this.refreshAvailableRooms();
            }
        }, intervalMs);
    }

    async toggleRoomHidden() {
        if (!this.currentRoomName) {
            this.ui.addMessage(t('room.hideFirst'), 'warning');
            return;
        }
        const proto = location.protocol === 'https:' ? 'https' : 'http';
        const newHidden = !this.roomHidden;
        const endpoint  = newHidden ? 'hide-room' : 'show-room';
        try {
            const res = await fetch(
                `${proto}://${location.hostname}/${endpoint}?room=${encodeURIComponent(this.currentRoomName)}`,
                { method: 'POST' }
            );
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            this.roomHidden = newHidden;
            const btn = document.getElementById('hideRoomBtn');
            if (btn) btn.textContent = this.roomHidden ? t('room.show') : t('room.hide');
            this.ui.addMessage(
                this.roomHidden ? t('room.hidden') : t('room.shown'),
                'info'
            );
        } catch (e) {
            this.ui.addMessage(t('room.toggleFailed').replace('{error}', e.message), 'error');
        }
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
                this.stopRoomAutoRefresh();
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
            const hideBtn = document.getElementById('hideRoomBtn');
            if (hideBtn) hideBtn.disabled = false;
        } catch (error) {
            this.ui.addMessage(`${t('connection.failed')}: ${error.message}`, 'error');
        }
    }

    disconnect() {
        this.midi.allNotesOff();
        this.recorder.recording && this.recorder.stop();
        this.playbackHandle?.cancel();
        this.playbackHandle = null;
        this.webrtc.disconnect();
        this.ui.addMessage(t('status.disconnected'), 'info');
        this.ui.updateConnectionStatus(t('status.disconnected'), 'disconnected');
        this.ui.updateButtonStates(false, false);
        this.ui.enableChat(false);
        this.webrtc.manualDisconnect = false;
        this.currentRoomName = '';
        this.roomHidden = false;
        const hideBtn = document.getElementById('hideRoomBtn');
        if (hideBtn) hideBtn.textContent = '🙈 Hide Room';
        const badge = document.getElementById('peerCountBadge');
        if (badge) badge.textContent = '';
        this.setRoomsVisibility(true);
        this.midi.refreshDevices();
        this.startRoomAutoRefresh();
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
        this.recorder.feed(data);

        // Stuck Note Prevention (outgoing)
        const status = data[0] & 0xF0;
        const pitch  = data[1];
        if (status === 0x90 && data[2] > 0) {
            if (this._activeNotes.has(pitch)) clearTimeout(this._activeNotes.get(pitch));
            const tid = setTimeout(() => {
                console.warn('[StuckNote] Auto-releasing pitch ' + pitch);
                this.midi.send([0x80 | (data[0] & 0x0F), pitch, 0]);
                this._activeNotes.delete(pitch);
            }, this.STUCK_NOTE_TIMEOUT_MS);
            this._activeNotes.set(pitch, tid);
        } else if (status === 0x80 || (status === 0x90 && data[2] === 0)) {
            if (this._activeNotes.has(pitch)) {
                clearTimeout(this._activeNotes.get(pitch));
                this._activeNotes.delete(pitch);
            }
        }

        // Send via Web Worker (binary) or fallback (JSON)
        if (this._midiWorker) {
            this._midiWorker.postMessage({
                type: 'midi',
                data: new Uint8Array(data),
                sysexEnabled:     this.settings.sysexEnabled,
                timestampEnabled: this.settings.timestampEnabled,
            });
        } else {
            const message = this.settings.timestampEnabled
                ? { data, timestamp: performance.now() } : { data };
            this.webrtc.send(message);
        }

        this.midi.announceMIDIEvent(data, this.settings.showMidiActivity);

        // Piano keyboard — local notes
        if (this._piano && data.length >= 3) {
            const st = data[0] & 0xF0, p = data[1];
            if (st === 0x90 && data[2] > 0) this._piano.noteOn(p, 'local');
            else if (st === 0x80 || (st === 0x90 && data[2] === 0)) this._piano.noteOff(p, 'local');
        }
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
            // Stuck Note Prevention (incoming) — track remote notes too
            if (data && data.length >= 3) {
                const st = data[0] & 0xF0;
                const p  = data[1];
                if (st === 0x90 && data[2] > 0) {
                    if (this._activeNotes.has('r' + p)) clearTimeout(this._activeNotes.get('r' + p));
                    const tid = setTimeout(() => {
                        console.warn('[StuckNote] Auto-releasing remote pitch', p);
                        this.midi.send([0x80 | (data[0] & 0x0F), p, 0]);
                        this._activeNotes.delete('r' + p);
                    }, this.STUCK_NOTE_TIMEOUT_MS);
                    this._activeNotes.set('r' + p, tid);
                } else if (st === 0x80 || (st === 0x90 && data[2] === 0)) {
                    if (this._activeNotes.has('r' + p)) {
                        clearTimeout(this._activeNotes.get('r' + p));
                        this._activeNotes.delete('r' + p);
                    }
                }
            }
            // Piano keyboard — remote notes
            if (this._piano && data && data.length >= 3) {
                const st = data[0] & 0xF0, p = data[1];
                if (st === 0x90 && data[2] > 0) this._piano.noteOn(p, 'remote');
                else if (st === 0x80 || (st === 0x90 && data[2] === 0)) this._piano.noteOff(p, 'remote');
            }
            // MIDIOutput.send() requires a typed array, not a plain Array
            this.midi.send(data instanceof Uint8Array ? data : new Uint8Array(data));
            if (this.settings.midiEchoEnabled && this.webrtc.isConnected()) {
                const echoMessage = this.settings.timestampEnabled ? { data, timestamp: performance.now() } : { data };
                this.webrtc.send(echoMessage);
            }
        } else if (msg.type === 'chat') {
            this.ui.addChatMessage(msg.data, 'peer');
        }
    }

    // ── Web Worker init ────────────────────────────────────────────────────

    _initMidiWorker() {
        try {
            this._midiWorker = new Worker(new URL('./midi-worker.js', import.meta.url), { type: 'module' });
            this._midiWorker.onmessage = (e) => this._onWorkerMessage(e.data);
            this._midiWorker.onerror   = (e) => {
                console.error('[MidiWorker] error, falling back to main thread:', e);
                this._midiWorker = null;
            };
            console.log('[MidiWorker] started');
        } catch (err) {
            console.warn('[MidiWorker] could not start, falling back to main thread:', err);
            this._midiWorker = null;
        }
    }

    _onWorkerMessage(msg) {
        if (msg.type === 'midi_ready') {
            // msg.buffer is a transferred ArrayBuffer with the compact binary packet
            this.webrtc.send(new Uint8Array(msg.buffer));
        }
        // 'dropped' messages are silently ignored (sysex filter etc.)
    }

    // ── IP version badge ───────────────────────────────────────────────────

    _updateIPVersionBadge(pathInfo) {
        const badge = document.getElementById('ipVersionBadge');
        if (!badge) return;
        const icons = { host: '🏠', srflx: '🌐', relay: '🔁' };
        const icon  = icons[pathInfo.candidateType] ?? '🔗';
        badge.textContent = icon + ' ' + pathInfo.ipVersion;
        badge.className   = 'ip-version-badge ip-version-' + (pathInfo.ipVersion === 'IPv6' ? 'v6' : 'v4');
        badge.title       = pathInfo.candidateType + ' | local: ' + pathInfo.localAddress;
        badge.hidden      = false;
    }

    // ── Emergency All Notes Off ────────────────────────────────────────────

    emergencyAllNotesOff() {
        // 1. Cancel every local stuck-note timer
        for (const tid of this._activeNotes.values()) clearTimeout(tid);
        this._activeNotes.clear();

        // 2. Send CC 123 (All Notes Off) to all 16 channels via MIDI output
        this.midi.allNotesOff();

        // 3. Also broadcast over WebRTC so the remote side silences too
        if (this.webrtc.isConnected()) {
            for (let ch = 0; ch < 16; ch++) {
                const cc123 = new Uint8Array([0xB0 | ch, 123, 0]);
                this.webrtc.send(cc123);
            }
        }

        this._piano?.allOff();
        this.ui.addMessage(t('debug.emergencySent'), 'warning');
    }

    // ── Stability Test ─────────────────────────────────────────────────────

    _startStabilityTest() {
        if (!this.webrtc.isConnected()) {
            this.ui.addMessage(t('stability.notConnected'), 'error');
            return;
        }
        const interval = parseInt(document.getElementById('stabInterval')?.value ?? 200);
        const duration = parseInt(document.getElementById('stabDuration')?.value ?? 10) * 1000;

        // Reset local tracking
        this._stabGaps = [];
        this._stabLost = 0;
        this._stabSent = 0;
        this._stabExpected = interval;
        this._stabAll  = [];

        document.getElementById('jitterChart').innerHTML = '';
        document.getElementById('stabilityStatus').textContent = t('stability.running');
        document.getElementById('stabilityStatus').className = 'running';
        document.getElementById('stabStartBtn').style.display = 'none';
        document.getElementById('stabStopBtn').style.display  = '';

        this.webrtc.startStabilityTest(interval, duration);

        // Auto-restore buttons when test ends
        this._stabEndTimer = setTimeout(() => this._stabDone(), duration + 500);
    }

    _stopStabilityTest() {
        clearTimeout(this._stabEndTimer);
        this.webrtc.stopStabilityTest();
        this._stabDone();
    }

    _stabDone() {
        document.getElementById('stabStartBtn').style.display = '';
        document.getElementById('stabStopBtn').style.display  = 'none';
    }

    _onStabilityUpdate(ev) {
        if (ev.type !== 'probe_result') return;

        const { gap, jitter, lost } = ev;
        const expected = this._stabExpected ?? 200;

        this._stabAll  = this._stabAll  ?? [];
        this._stabGaps = this._stabGaps ?? [];
        this._stabLost = (this._stabLost ?? 0) + (lost ?? 0);
        this._stabSent = (this._stabSent ?? 0) + 1;

        this._stabAll.push(gap);

        // Compute running jitter (stddev of gaps)
        const mean     = this._stabAll.reduce((a, b) => a + b, 0) / this._stabAll.length;
        const variance = this._stabAll.reduce((s, g) => s + (g - mean) ** 2, 0) / this._stabAll.length;
        const runJitter = Math.sqrt(variance);

        const stable = runJitter < expected * 0.2 && (this._stabLost / Math.max(this._stabSent, 1)) < 0.05;

        // Update stats display
        const el = (id) => document.getElementById(id);
        if (el('stabJitter')) el('stabJitter').textContent = runJitter.toFixed(1);
        if (el('stabLost'))   el('stabLost').textContent   = this._stabLost;
        if (el('stabSent'))   el('stabSent').textContent   = this._stabSent;
        if (el('stabMin'))    el('stabMin').textContent    = Math.min(...this._stabAll).toFixed(0);
        if (el('stabMax'))    el('stabMax').textContent    = Math.max(...this._stabAll).toFixed(0);

        const statusEl = el('stabilityStatus');
        if (statusEl) {
            statusEl.textContent = stable ? t('stability.stable') : t('stability.unstable');
            statusEl.className   = stable ? 'stable' : 'unstable';
        }

        // Append jitter bar
        const chart = el('jitterChart');
        if (chart) {
            const bar = document.createElement('div');
            bar.className = 'jitter-bar ' + (jitter < expected * 0.1 ? 'ok' : jitter < expected * 0.25 ? 'warning' : 'bad');
            // Height: clamp jitter to 0–50 px range
            const h = Math.min(50, Math.max(2, (jitter / expected) * 50));
            bar.style.height = h + 'px';
            bar.title = `gap ${gap.toFixed(0)} ms | jitter ${jitter.toFixed(1)} ms`;
            chart.appendChild(bar);
            // Keep last 60 bars
            while (chart.children.length > 60) chart.removeChild(chart.firstChild);
        }
    }

    // ── Connection state helpers ────────────────────────────────────────────

    _onConnectionChange(connected) {
        const stabBtn = document.getElementById('stabStartBtn');
        if (stabBtn) stabBtn.disabled = !connected;
        if (!connected) {
            this._piano?.allOff();
            document.getElementById('stabStopBtn').style.display  = 'none';
            document.getElementById('stabStartBtn').style.display = '';
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
