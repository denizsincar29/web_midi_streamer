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
        
        inputSelect.innerHTML = '<option value="">No device selected</option>';
        outputSelect.innerHTML = '<option value="">No device selected</option>';
        
        if (!this.access) return;
        
        for (let input of this.access.inputs.values()) {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name;
            inputSelect.appendChild(option);
        }
        
        for (let output of this.access.outputs.values()) {
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name;
            outputSelect.appendChild(option);
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
            this.selectedOutput.send(data);
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
}
