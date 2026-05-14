import { getNoteName } from './utils.js';

export class MIDIManager {
    constructor(translateFn) {
        this._t    = translateFn ?? ((k) => k);  // i18n helper, injected by app
        this.access = null;
        this.selectedInput = null;
        this.selectedOutput = null;
        this.onMessage = null;
        this.chimes = null; // Loaded from chimes.json
        this.chimesLoaded = false;
        this.chimesLoading = this.loadChimes(); // Start loading immediately
        
        // Storage keys for device persistence
        this.STORAGE_KEY_INPUT = 'webmidi_selectedInputId';
        this.STORAGE_KEY_OUTPUT = 'webmidi_selectedOutputId';
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
        const inputSelect = document.getElementById('midiInput');
        const outputSelect = document.getElementById('midiOutput');
        
        if (!this.access) return;
        
        // Clear existing options
        inputSelect.innerHTML = '';
        outputSelect.innerHTML = '';
        
        // Collect devices into arrays
        const inputs = Array.from(this.access.inputs.values());
        const outputs = Array.from(this.access.outputs.values());
        
        // Get previously saved device IDs from storage
        const savedInputId = localStorage.getItem(this.STORAGE_KEY_INPUT);
        const savedOutputId = localStorage.getItem(this.STORAGE_KEY_OUTPUT);
        
        let selectedInputId = null;
        let selectedOutputId = null;
        
        // Only show "No device selected" if there are no devices
        if (inputs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = this._t('midi.noDevice');
            inputSelect.appendChild(option);
        } else {
            // Add all input devices
            inputs.forEach((input, index) => {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name;
                inputSelect.appendChild(option);
                
                // Try to restore saved device, otherwise use first
                if (input.id === savedInputId) {
                    selectedInputId = input.id;
                    option.selected = true;
                } else if (!selectedInputId && index === 0) {
                    selectedInputId = input.id;
                    option.selected = true;
                }
            });
            // Auto-select chosen input device
            if (selectedInputId) {
                this.selectInput(selectedInputId);
            }
        }
        
        if (outputs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = this._t('midi.noDevice');
            outputSelect.appendChild(option);
        } else {
            // Add all output devices
            outputs.forEach((output, index) => {
                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name;
                outputSelect.appendChild(option);
                
                // Try to restore saved device, otherwise use first
                if (output.id === savedOutputId) {
                    selectedOutputId = output.id;
                    option.selected = true;
                } else if (!selectedOutputId && index === 0) {
                    selectedOutputId = output.id;
                    option.selected = true;
                }
            });
            // Auto-select chosen output device
            if (selectedOutputId) {
                this.selectOutput(selectedOutputId);
            }
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
            // Save to localStorage
            localStorage.setItem(this.STORAGE_KEY_INPUT, deviceId);
        } else {
            this.selectedInput = null;
            localStorage.removeItem(this.STORAGE_KEY_INPUT);
        }
    }

    selectOutput(deviceId) {
        if (deviceId && this.access) {
            this.selectedOutput = this.access.outputs.get(deviceId);
            // Save to localStorage
            localStorage.setItem(this.STORAGE_KEY_OUTPUT, deviceId);
        } else {
            this.selectedOutput = null;
            localStorage.removeItem(this.STORAGE_KEY_OUTPUT);
        }
    }

    send(data) {
        if (this.selectedOutput) {
            // MIDIOutput.send() requires a Uint8Array or array-like of integers
            const bytes = (data instanceof Uint8Array) ? data : new Uint8Array(data);
            try {
                this.selectedOutput.send(bytes);
            } catch (error) {
                console.error('MIDI send error:', error);
                // Only refresh device list if the output port disappeared;
                // don't spam refreshDevices() on every data-format error
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
        if (!this.selectedOutput) return;
        
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
        
        const chimeConfig = this.chimes[type] || this.chimes['info'];
        if (!chimeConfig) return;
        
        // Handle different chime types
        if (chimeConfig.type === 'midi') {
            // MIDI file playback not yet implemented
            console.warn('MIDI file playback not yet implemented, using default chime');
            // Fall back to playing a simple note
            this.playNoteSequence({ notes: 'A4', velocity: 90, duration: 150 });
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
