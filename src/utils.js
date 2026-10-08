import { NOTE_NAMES } from './config.js';

export function getRoomNameFromURL() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('room');
    if (query) return query;

    // Observer shorthand: «=roomname=» anywhere in the address — a bare
    // host/=studio= is what the admin types to lurk in a room, and the equals
    // signs are what mark the name out from a path. Checked in the hash and
    // the raw search string because neither survives the other cleanly.
    const shorthand = matchObserverRoom(window.location.hash) ||
                      matchObserverRoom(window.location.search);
    return shorthand || null;
}

function matchObserverRoom(source) {
    if (!source) return null;
    const match = /=(.+?)=/.exec(decodeURIComponent(source));
    return match ? match[1].trim() || null : null;
}

export function isObserverURL() {
    return !!(matchObserverRoom(window.location.hash) ||
              matchObserverRoom(window.location.search)) &&
           !new URLSearchParams(window.location.search).get('room');
}

export function getNameFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('name') || null;
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
