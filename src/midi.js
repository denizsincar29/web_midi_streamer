import { getNoteName } from './utils.js';

export class MIDIManager {
    constructor() {
        this.access = null;
        this.selectedInput = null;
        this.selectedOutput = null;
        this.onMessage = null;
        this.chimes = null; // Loaded from chimes.json
        this.loadChimes();
    }

    async loadChimes() {
        try {
            const response = await fetch('chimes.json');
            this.chimes = await response.json();
            console.log('Loaded MIDI chimes configuration');
        } catch (error) {
            console.warn('Failed to load chimes.json, using defaults:', error);
            // Fallback to default chimes
            this.chimes = {
                'success': {
                    type: 'notes',
                    notes: 'C5 E5',
                    velocity: 100,
                    duration: 100
                },
                'info': {
                    type: 'notes',
                    notes: 'A4',
                    velocity: 90,
                    duration: 150
                },
                'warning': {
                    type: 'notes',
                    notes: 'G4 F4',
                    velocity: 100,
                    duration: 100
                },
                'error': {
                    type: 'notes',
                    notes: 'F4 D4',
                    velocity: 110,
                    duration: 200
                },
                'connecting': {
                    type: 'notes',
                    notes: 'E4 G4',
                    velocity: 85,
                    duration: 80
                }
            };
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
        
        // Only show "No device selected" if there are no devices
        if (inputs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No device selected';
            inputSelect.appendChild(option);
        } else {
            // Add all input devices
            inputs.forEach((input, index) => {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name;
                if (index === 0) option.selected = true; // Select first device by default
                inputSelect.appendChild(option);
            });
            // Auto-select first input device
            this.selectInput(inputs[0].id);
        }
        
        if (outputs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No device selected';
            outputSelect.appendChild(option);
        } else {
            // Add all output devices
            outputs.forEach((output, index) => {
                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name;
                if (index === 0) option.selected = true; // Select first device by default
                outputSelect.appendChild(option);
            });
            // Auto-select first output device
            this.selectOutput(outputs[0].id);
        }
    }

    selectInput(deviceId) {
        if (this.selectedInput) {
            this.selectedInput.onmidimessage = null;
        }
        
        if (deviceId && this.access) {
            this.selectedInput = this.access.inputs.get(deviceId);
            this.selectedInput.onmidimessage = (event) => {
                if (this.onMessage) {
                    this.onMessage(Array.from(event.data));
                }
            };
        } else {
            this.selectedInput = null;
        }
    }

    selectOutput(deviceId) {
        if (deviceId && this.access) {
            this.selectedOutput = this.access.outputs.get(deviceId);
        } else {
            this.selectedOutput = null;
        }
    }

    send(data) {
        if (this.selectedOutput) {
            try {
                this.selectedOutput.send(data);
            } catch (error) {
                console.error('MIDI send error:', error);
                // The output device may have been disconnected
                // Refresh devices to update the UI
                this.refreshDevices();
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
        const noteValue = noteMap[note.toUpperCase()];
        
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
        
        // Wait for chimes to load if still loading
        if (!this.chimes) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!this.chimes) return; // Still not loaded, skip
        }
        
        const chimeConfig = this.chimes[type] || this.chimes['info'];
        if (!chimeConfig) return;
        
        // Handle different chime types
        if (chimeConfig.type === 'midi') {
            // Load and play MIDI file
            await this.playMidiFile(chimeConfig.file);
        } else if (chimeConfig.type === 'notes') {
            // Play note sequence
            this.playNoteSequence(chimeConfig);
        }
    }
    
    /**
     * Play a sequence of notes
     * @param {Object} config - Configuration with notes, velocity, duration
     */
    playNoteSequence(config) {
        const noteNames = config.notes.split(/\s+/);
        const velocity = config.velocity || 100;
        const duration = config.duration || 100;
        let delay = 0;
        
        noteNames.forEach(noteName => {
            const noteNumber = this.noteNameToNumber(noteName);
            
            setTimeout(() => {
                // Note on
                this.send([0x90, noteNumber, velocity]);
                // Note off after duration
                setTimeout(() => {
                    this.send([0x80, noteNumber, 0]);
                }, duration);
            }, delay);
            delay += duration + 50; // Small gap between notes
        });
    }
    
    /**
     * Load and play a MIDI file
     * @param {string} filePath - Path to MIDI file
     */
    async playMidiFile(filePath) {
        try {
            const response = await fetch(filePath);
            const arrayBuffer = await response.arrayBuffer();
            
            // Parse MIDI file (simplified - would need a full MIDI parser for production)
            // For now, just log that we received it
            console.log('MIDI file loaded:', filePath, 'Size:', arrayBuffer.byteLength);
            
            // TODO: Implement full MIDI file parsing and playback
            // This would require a MIDI file parser library or custom implementation
            console.warn('MIDI file playback not yet fully implemented');
            
        } catch (error) {
            console.error('Failed to load MIDI file:', filePath, error);
        }
    }
}
