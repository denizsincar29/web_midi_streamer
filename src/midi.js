import { getNoteName } from './utils.js';

export class MIDIManager {
    constructor(translateFn) {
        this._t    = translateFn ?? ((k) => k);  // i18n helper, injected by app
        this.access = null;
        this.selectedInput  = null;
        this.selectedOutput = null;
        this.synth          = null;   // BrowserSynth instance, set by app.js
        this.onMessage = null;
        this.chimes = null; // Loaded from chimes.json
        this.chimesLoaded = false;
        this.chimesLoading = this.loadChimes(); // Start loading immediately
        
        // Storage keys for device persistence
        this.STORAGE_KEY_INPUT       = 'webmidi_selectedInputId';
        this.STORAGE_KEY_OUTPUT      = 'webmidi_selectedOutputId';
        this.STORAGE_KEY_INPUT_NAME  = 'webmidi_selectedInputName';
        this.STORAGE_KEY_OUTPUT_NAME = 'webmidi_selectedOutputName';
        this.SYNTH_OUTPUT_VALUE      = '__synth__';
    }

    async loadChimes() {
        try {
            const response = await fetch('chimes.json');
            this.chimes = await response.json();
            this.chimesLoaded = true;
            console.log('Loaded MIDI chimes configuration');
        } catch (error) {
            console.warn('Failed to load chimes.json, using defaults:', error);
            // Fallback to default chimes (reduced velocity for quieter sound)
            this.chimes = {
                'success': {
                    type: 'notes',
                    notes: 'C5 E5',
                    velocity: 60,
                    duration: 100
                },
                'info': {
                    type: 'notes',
                    notes: 'A4',
                    velocity: 50,
                    duration: 150
                },
                'warning': {
                    type: 'notes',
                    notes: 'G4 F4',
                    velocity: 60,
                    duration: 100
                },
                'error': {
                    type: 'notes',
                    notes: 'F#6+C6 C#6+A6',
                    velocity: 80,
                    duration: 150
                },
                'connecting': {
                    type: 'notes',
                    notes: 'E4 G4',
                    velocity: 50,
                    duration: 80
                },
                'room_connection': {
                    type: 'notes',
                    notes: 'C#7 F7',
                    velocity: 80,
                    duration: 50
                },
                'peer_connection': {
                    type: 'notes',
                    notes: 'Ab6 Db6 F6 Db7',
                    velocity: 75,
                    duration: 60
                },
                'startup': {
                    type: 'notes',
                    notes: 'C5 E5 G5 C6',
                    velocity: 65,
                    duration: 70
                }
            };
            this.chimesLoaded = true;
        }
    }

    async init() {
        this.access = await navigator.requestMIDIAccess({ sysex: true });
        this.access.onstatechange = () => this.refreshDevices();
        return this.access;
    }

    refreshDevices() {
        const inputSelect  = document.getElementById('midiInput');
        const outputSelect = document.getElementById('midiOutput');
        if (!this.access) return;

        const inputs  = Array.from(this.access.inputs.values());
        const outputs = Array.from(this.access.outputs.values());

        const savedInputId    = localStorage.getItem(this.STORAGE_KEY_INPUT);
        const savedInputName  = localStorage.getItem(this.STORAGE_KEY_INPUT_NAME);
        const savedOutputId   = localStorage.getItem(this.STORAGE_KEY_OUTPUT);
        const savedOutputName = localStorage.getItem(this.STORAGE_KEY_OUTPUT_NAME);

        // ── Helper: find best match for a device list ──────────────────────
        // Priority: exact ID match → name match → first available → null
        const findBest = (devices, savedId, savedName) => {
            if (!savedId && !savedName) return devices[0] ?? null;
            const byId   = savedId   ? devices.find(d => d.id === savedId)     : null;
            const byName = savedName ? devices.find(d => d.name === savedName) : null;
            return byId ?? byName ?? null;
        };

        // ── Build input selector ───────────────────────────────────────────
        inputSelect.innerHTML = '';
        const bestInput = findBest(inputs, savedInputId, savedInputName);

        if (savedInputName && !bestInput) {
            // Preferred device is gone — show a "waiting" placeholder
            const waiting = document.createElement('option');
            waiting.value = '';
            waiting.textContent = '⏳ ' + savedInputName;
            waiting.disabled = false;
            waiting.selected = true;
            inputSelect.appendChild(waiting);
        }
        if (inputs.length === 0 && !savedInputName) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = this._t('midi.noDevice');
            inputSelect.appendChild(option);
        }
        inputs.forEach(input => {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name;
            if (bestInput && input.id === bestInput.id) option.selected = true;
            inputSelect.appendChild(option);
        });
        if (bestInput) this.selectInput(bestInput.id);

        // ── Build output selector ──────────────────────────────────────────
        outputSelect.innerHTML = '';

        // NOTE: Browser Synth option removed — synth deprecated in favour of
        // hardware MIDI output + local monitor toggle.
        // const synthOption = document.createElement('option');
        // synthOption.value = this.SYNTH_OUTPUT_VALUE;
        // synthOption.textContent = '🔊 ' + this._t('synth.name');
        // outputSelect.appendChild(synthOption);

        const bestOutput = findBest(outputs, savedOutputId, savedOutputName);

        if (outputs.length === 0) {
            const none = document.createElement('option');
            none.value = '';
            none.textContent = this._t('midi.noDevice');
            outputSelect.appendChild(none);
        }

        // If saved output is gone, show waiting placeholder
        if (savedOutputName && savedOutputId !== this.SYNTH_OUTPUT_VALUE && !bestOutput) {
            const waiting = document.createElement('option');
            waiting.value = '';
            waiting.textContent = '⏳ ' + savedOutputName;
            waiting.selected = true;
            outputSelect.appendChild(waiting);
        }

        outputs.forEach(output => {
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name;
            if (bestOutput && output.id === bestOutput.id) option.selected = true;
            outputSelect.appendChild(option);
        });

        // Decide what to select — hardware only now
        if (bestOutput) {
            this.selectOutput(bestOutput.id);
        } else {
            this.selectedOutput = null;
        }
    }

    selectInput(deviceId) {
        if (this.selectedInput) {
            this.selectedInput.onmidimessage = null;
        }
        
        if (deviceId && this.access) {
            const input = this.access.inputs.get(deviceId);
            if (!input) {
                // Device ID no longer valid (unplugged etc.) — clear selection
                this.selectedInput = null;
                localStorage.removeItem(this.STORAGE_KEY_INPUT);
                return;
            }
            this.selectedInput = input;
            this.selectedInput.onmidimessage = (event) => {
                if (this.onMessage) {
                    this.onMessage(Array.from(event.data));
                }
            };
            // Save ID and name — name-based matching survives replug with new ID
            localStorage.setItem(this.STORAGE_KEY_INPUT, deviceId);
            localStorage.setItem(this.STORAGE_KEY_INPUT_NAME, input.name);
        } else {
            this.selectedInput = null;
            localStorage.removeItem(this.STORAGE_KEY_INPUT);
        }
    }

    selectOutput(deviceId) {
        // NOTE: SYNTH_OUTPUT_VALUE path deprecated — synth no longer appears in dropdown
        // if (deviceId === this.SYNTH_OUTPUT_VALUE) { ... }

        // Synth monitoring is now handled separately via the monitor toggle in app.js
        if (deviceId && this.access) {
            this.selectedOutput = this.access.outputs.get(deviceId);
            localStorage.setItem(this.STORAGE_KEY_OUTPUT, deviceId);
            if (this.selectedOutput) {
                localStorage.setItem(this.STORAGE_KEY_OUTPUT_NAME, this.selectedOutput.name);
            }
        } else {
            this.selectedOutput = null;
            localStorage.removeItem(this.STORAGE_KEY_OUTPUT);
        }
    }

    send(data) {
        const arr = Array.from((data instanceof Uint8Array) ? data : new Uint8Array(data));

        // NOTE: Synth routing removed — monitor toggle in app.js handles local playback
        // if (this.synth?.enabled) { this.synth.processMidi(arr); }

        // Send to hardware output if connected
        if (this.selectedOutput) {
            try {
                this.selectedOutput.send(new Uint8Array(arr));
            } catch (error) {
                console.error('MIDI send error:', error);
                if (error instanceof DOMException || this.selectedOutput.state === 'disconnected') {
                    this.refreshDevices();
                }
            }
        }
    }

    announceMIDIEvent(data, showActivity) {
        if (!showActivity) return;
        
        const status = data[0] & 0xF0;
        const note = data[1];
        let announcement = '';
        
        if (status === 0x90 && data[2] > 0) {
            announcement = `${getNoteName(note)} on`;
        } else if (status === 0x80 || (status === 0x90 && data[2] === 0)) {
            announcement = `${getNoteName(note)} off`;
        } else if (status === 0xB0) {
            announcement = `CC ${data[1]}`;
        } else if (status === 0xC0) {
            announcement = `Program ${data[1]}`;
        }
        
        if (announcement) {
            document.getElementById('midiActivity').textContent = announcement;
        }
    }

    /**
     * Convert note name (e.g., "C4", "A#5") to MIDI note number
     * @param {string} noteName - Note name with octave (e.g., "C4", "F#5")
     * @returns {number} MIDI note number (0-127)
     */
    noteNameToNumber(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        // Parse note name and octave
        const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/i);
        if (!match) {
            console.error('Invalid note name:', noteName);
            return 60; // Default to middle C
        }
        
        const [, note, octave] = match;
        // Normalise to Title-case so 'bb' -> 'Bb', 'BB' -> 'Bb', 'C#' stays 'C#'
        const noteNorm = note.charAt(0).toUpperCase() + note.slice(1).toLowerCase();
        const noteValue = noteMap[noteNorm];
        
        if (noteValue === undefined) {
            console.error('Unknown note:', note);
            return 60;
        }
        
        // MIDI note number = (octave + 1) * 12 + note value
        return (parseInt(octave) + 1) * 12 + noteValue;
    }

    /**
     * Play a MIDI chime sound for status notifications
     * Loads configuration from chimes.json
     * @param {string} type - Type of chime: 'success', 'info', 'warning', 'error', 'connecting'
     */
    async playStatusChime(type) {
        if (!this.selectedOutput && !this.synth?.enabled) return;
        
        // Wait for chimes to finish loading with timeout
        if (!this.chimesLoaded) {
            try {
                await Promise.race([
                    this.chimesLoading,
                    new Promise((_, reject) => setTimeout(() => reject('timeout'), 500))
                ]);
            } catch (error) {
                console.warn('Chimes loading timed out or failed, skipping chime');
                return;
            }
        }
        
        const chimeConfig = this.chimes[type];
        if (!chimeConfig) return;
        
        // Handle different chime types
        if (chimeConfig.type === 'midi') {
            this._playMidiFile(chimeConfig.file);
        } else if (chimeConfig.type === 'notes') {
            // Play note sequence
            this.playNoteSequence(chimeConfig);
        }
    }
    
    /**
     * Play a sequence of notes, supporting simultaneous notes with + separator
     * @param {Object} config - Configuration with notes, velocity, duration
     * Format: "C4 E4 G4" for sequential, "C4+E4 G4+B4" for simultaneous
     */
    playNoteSequence(config) {
        const noteGroups = config.notes.split(/\s+/);
        const velocity = config.velocity || 100;
        const duration = config.duration || 100;
        let delay = 0;
        
        noteGroups.forEach((group) => {
            // Split by + to find simultaneous notes
            const notes = group.split('+');
            
            setTimeout(() => {
                // Note on for all notes in group
                notes.forEach(noteName => {
                    const noteNumber = this.noteNameToNumber(noteName.trim());
                    this.send([0x90, noteNumber, velocity]);
                });
                
                // Note off after duration
                setTimeout(() => {
                    notes.forEach(noteName => {
                        const noteNumber = this.noteNameToNumber(noteName.trim());
                        this.send([0x80, noteNumber, 0]);
                    });
                }, duration);
            }, delay);
            
            delay += duration + 50; // Small gap between groups
        });
    }

    /**
     * Send "All Notes Off" CC to all 16 MIDI channels
     * This ensures no stuck notes when page unloads or disconnects
     */
    // ── MIDI file chime playback ────────────────────────────────────────────────

    /**
     * Fetch and play a Standard MIDI File (SMF type 0 or 1).
     * Only channel-voice messages are forwarded; meta/sysex are skipped.
     * @param {string} url - path relative to the page (e.g. "./chimes/logo.mid")
     */
    async _playMidiFile(url) {
        if (!url) { console.warn('[chime] midi type requires a "file" field'); return; }
        let buf;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            buf = await res.arrayBuffer();
        } catch (e) {
            console.warn('[chime] failed to load MIDI file:', url, e);
            return;
        }
        const events = this._parseSMF(buf);
        if (!events.length) { console.warn('[chime] no playable events in', url); return; }
        // Cancel any in-progress MIDI file chime
        if (this._midiFileTimers) this._midiFileTimers.forEach(clearTimeout);
        this._midiFileTimers = [];
        for (const ev of events) {
            const tid = setTimeout(() => this.send(ev.data), ev.ms);
            this._midiFileTimers.push(tid);
        }
    }

    /**
     * Minimal SMF parser — returns [{ms, data}] sorted by time.
     * Handles type-0 and type-1 files. Ignores sysex and meta events.
     * Tempo meta events (FF 51) ARE tracked so timing is accurate.
     */
    _parseSMF(buf) {
        const u8 = new Uint8Array(buf);
        const dv = new DataView(buf);
        let pos  = 0;

        const read8   = () => u8[pos++];
        const read16  = () => { const v = dv.getUint16(pos, false); pos += 2; return v; };
        const read32  = () => { const v = dv.getUint32(pos, false); pos += 4; return v; };
        const readVLQ = () => {
            let val = 0;
            for (let i = 0; i < 4; i++) {
                const b = read8();
                val = (val << 7) | (b & 0x7f);
                if (!(b & 0x80)) break;
            }
            return val;
        };
        const tag = (p) => String.fromCharCode(u8[p], u8[p+1], u8[p+2], u8[p+3]);

        if (tag(0) !== 'MThd') { console.warn('[SMF] not a MIDI file'); return []; }
        pos = 4;
        read32(); // header length (always 6)
        read16(); // format (0 or 1, both handled)
        const numTracks = read16();
        const division  = read16();

        if (division & 0x8000) { console.warn('[SMF] SMPTE time code not supported'); return []; }
        const tpq = division; // ticks per quarter note

        // Pass 1: collect tick-stamped events from all tracks
        const rawEvents = []; // {tick, data} for voice events; {tick, tempo} for tempo changes

        for (let tr = 0; tr < numTracks; tr++) {
            if (pos + 8 > u8.length) break;
            if (tag(pos) !== 'MTrk') { console.warn('[SMF] missing MTrk at', pos); break; }
            pos += 4;
            const chunkLen = read32();
            const chunkEnd = pos + chunkLen;
            let tick    = 0;
            let running = 0;

            while (pos < chunkEnd) {
                tick += readVLQ();
                let status = u8[pos];

                if (status === 0xFF) {
                    // Meta event
                    pos++;
                    const metaType = read8();
                    const len      = readVLQ();
                    if (metaType === 0x51 && len === 3) {
                        // Tempo: 3-byte microseconds-per-beat
                        const usPerBeat = (u8[pos] << 16) | (u8[pos+1] << 8) | u8[pos+2];
                        rawEvents.push({ tick, tempo: usPerBeat });
                    }
                    pos += len;
                    running = 0;
                    continue;
                }
                if (status === 0xF0 || status === 0xF7) {
                    pos++;
                    pos += readVLQ(); // skip sysex body
                    running = 0;
                    continue;
                }

                let cmd;
                if (status & 0x80) { cmd = running = status; pos++; }
                else               { cmd = running; }

                const type = cmd & 0xF0;
                let data;
                if (type === 0xC0 || type === 0xD0) {
                    data = [cmd, read8()];
                } else {
                    data = [cmd, read8(), read8()];
                }
                rawEvents.push({ tick, data });
            }
            pos = chunkEnd;
        }

        if (!rawEvents.length) return [];
        rawEvents.sort((a, b) => a.tick - b.tick);

        // Pass 2: convert ticks → ms honouring tempo changes
        const voiceEvents = [];
        let curTick   = 0;
        let curMs     = 0;
        let usPerBeat = 500000; // default 120 BPM

        for (const ev of rawEvents) {
            const elapsed = ev.tick - curTick;
            curMs   += (elapsed / tpq) * (usPerBeat / 1000);
            curTick  = ev.tick;
            if (ev.tempo !== undefined) { usPerBeat = ev.tempo; continue; }
            voiceEvents.push({ ms: Math.round(curMs), data: ev.data });
        }

        return voiceEvents;
    }

    allNotesOff() {
        if (!this.selectedOutput) return;
        
        try {
            // Send CC 123 (All Notes Off) to all 16 channels (0-15)
            for (let channel = 0; channel < 16; channel++) {
                const ccMessage = [0xB0 | channel, 123, 0]; // CC 123 = All Notes Off
                this.send(ccMessage);
            }
            console.log('All MIDI notes released');
        } catch (error) {
            console.error('Error sending all notes off:', error);
        }
    }
}
