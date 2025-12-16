import { NOTE_NAMES } from './config.js';

export function getRemotePeerIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('peer') || null;
}

export function getNoteName(midiNote) {
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = NOTE_NAMES[midiNote % 12];
    return `${noteName}${octave}`;
}

export function generatePeerId() {
    const randomPart = crypto.randomUUID ? 
        crypto.randomUUID().split('-')[0] : 
        Math.random().toString(36).slice(2, 11);
    return `midi-${Date.now()}-${randomPart}`;
}

export function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        return Promise.resolve();
    }
}
