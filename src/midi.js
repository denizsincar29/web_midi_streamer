import { getNoteName } from './utils.js';

export class MIDIManager {
    constructor() {
        this.access = null;
        this.selectedInput = null;
        this.selectedOutput = null;
        this.onMessage = null;
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
     * Play a MIDI chime sound for status notifications
     * @param {string} type - Type of chime: 'success', 'info', 'warning', 'error', 'connecting'
     */
    playStatusChime(type) {
        if (!this.selectedOutput) return;
        
        const chimes = {
            'success': [
                { note: 72, velocity: 100, duration: 100 },  // C5
                { note: 76, velocity: 100, duration: 100 },  // E5
            ],
            'info': [
                { note: 69, velocity: 90, duration: 150 },   // A4
            ],
            'warning': [
                { note: 67, velocity: 100, duration: 100 },  // G4
                { note: 65, velocity: 100, duration: 100 },  // F4
            ],
            'error': [
                { note: 65, velocity: 110, duration: 200 },  // F4
                { note: 62, velocity: 110, duration: 200 },  // D4
            ],
            'connecting': [
                { note: 64, velocity: 85, duration: 80 },    // E4
                { note: 67, velocity: 85, duration: 80 },    // G4
            ]
        };
        
        const sequence = chimes[type] || chimes['info'];
        let delay = 0;
        
        sequence.forEach(({ note, velocity, duration }) => {
            setTimeout(() => {
                // Note on
                this.send([0x90, note, velocity]);
                // Note off after duration
                setTimeout(() => {
                    this.send([0x80, note, 0]);
                }, duration);
            }, delay);
            delay += duration + 50; // Small gap between notes
        });
    }
}
