import { t, getCurrentLanguage, initI18n } from '../../js/i18n.js';
import { midiNoteToName, getPitchClass, noteNameToSemitone, detectChord } from '../../js/chord-utils.js';

let midiAccess = null;
let selectedInput = null;
let activeNotes = new Set(); // Set of active MIDI note numbers
let lastChordName = ''; // Store last chord name for screen reader announcement
let notesWereActive = false; // Track if notes were previously active
let chordDebounceTimer = null; // Timer for debouncing chord announcements

// Initialize MIDI
async function initMIDI() {
    try {
        midiAccess = await navigator.requestMIDIAccess();
        updateMIDIStatus(t('chordDisplay.accessGranted'), true);
        populateInputDevices();
        midiAccess.onstatechange = populateInputDevices;
    } catch (error) {
        updateMIDIStatus(t('chordDisplay.accessDenied') + ' ' + error.message, false);
    }
}

function updateMIDIStatus(message, connected) {
    const statusEl = document.getElementById('midiStatus');
    const statusText = document.getElementById('statusText');
    statusText.textContent = message;
    statusEl.className = connected ? 'midi-status connected' : 'midi-status';
}

function populateInputDevices() {
    const select = document.getElementById('midiInput');
    select.innerHTML = `<option value="">${t('chordDisplay.noDeviceSelected')}</option>`;

    const inputs = Array.from(midiAccess.inputs.values());
    inputs.forEach((input, index) => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name;
        if (index === 0) option.selected = true;
        select.appendChild(option);
    });

    // Auto-select first device
    if (inputs.length > 0) {
        selectInput(inputs[0].id);
    }
}

function selectInput(deviceId) {
    // Disconnect previous input
    if (selectedInput) {
        selectedInput.onmidimessage = null;
    }

    if (deviceId && midiAccess) {
        selectedInput = midiAccess.inputs.get(deviceId);
        selectedInput.onmidimessage = handleMIDIMessage;
        updateMIDIStatus(t('chordDisplay.connectedTo') + ' ' + selectedInput.name, true);
    } else {
        selectedInput = null;
        updateMIDIStatus(t('chordDisplay.noDevice'), false);
    }
}

function handleMIDIMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xF0;

    // Note On
    if (command === 0x90 && velocity > 0) {
        activeNotes.add(note);
        updateDisplay();
    }
    // Note Off
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        activeNotes.delete(note);
        updateDisplay();
    }
}

function updateDisplay() {
    const noteListEl = document.getElementById('noteList');
    const chordNameEl = document.getElementById('chordName');
    const chordNotesEl = document.getElementById('chordNotes');
    const chordAnnouncementEl = document.getElementById('chordAnnouncement');

    if (activeNotes.size === 0) {
        // When no notes are being played, show the last chord but indicate notes have been released
        noteListEl.innerHTML = `<span style="color: #999;">${t('chordDisplay.noNotesPlaying')}</span>`;

        // Keep showing the last chord name if we have one
        if (lastChordName) {
            // Don't change the chord display - keep showing last chord
            // Announce the chord name one final time when all notes are released
            if (notesWereActive) {
                chordAnnouncementEl.textContent = lastChordName;
                notesWereActive = false;
            }
        } else {
            chordNameEl.innerHTML = `<span class="placeholder-text">${t('chordDisplay.playNotes')}</span>`;
            chordNotesEl.textContent = '';
        }
        return;
    }

    // Mark that we have notes
    notesWereActive = true;

    // Convert MIDI notes to note names
    const noteNames = Array.from(activeNotes)
        .sort((a, b) => a - b)
        .map(midiNoteToName);

    // Display active notes
    noteListEl.innerHTML = noteNames
        .map(note => `<span class="note-badge">${note}</span>`)
        .join('');

    // Detect chords with debouncing for screen reader
    detectAndDisplayChord(noteNames);
}

function detectAndDisplayChord(noteNames) {
    const chordNameEl = document.getElementById('chordName');
    const chordNotesEl = document.getElementById('chordNotes');
    const chordAnnouncementEl = document.getElementById('chordAnnouncement');

    if (noteNames.length < 1) {
        chordNameEl.innerHTML = `<span class="placeholder-text">${t('chordDisplay.playNotes')}</span>`;
        chordNotesEl.textContent = '';
        return;
    }

    // Clear any existing debounce timer
    if (chordDebounceTimer) {
        clearTimeout(chordDebounceTimer);
    }

    if (noteNames.length === 1) {
        // Single note
        const pitchClass = getPitchClass(noteNames[0]);
        const singleNoteText = `${pitchClass}`;
        chordNameEl.textContent = singleNoteText;
        chordNotesEl.textContent = t('chordDisplay.singleNote');
        lastChordName = singleNoteText;
        // Debounce announcement for single notes too
        chordDebounceTimer = setTimeout(() => {
            chordAnnouncementEl.textContent = singleNoteText;
        }, 300);
        return;
    }

    // Detect chord
    const chordInfo = detectChord(noteNames);

    if (!chordInfo) {
        const notesText = noteNames.map(getPitchClass).join(' ');
        chordNameEl.textContent = notesText;
        chordNotesEl.textContent = t('chordDisplay.customVoicing');
        lastChordName = notesText;
        // Debounce announcement
        chordDebounceTimer = setTimeout(() => {
            chordAnnouncementEl.textContent = notesText;
        }, 300);
        return;
    }

    if (chordInfo.type === 'Custom') {
        chordNameEl.style.fontSize = '3em';
        const customText = chordInfo.notes.join(' ');
        chordNameEl.textContent = customText;
        chordNotesEl.textContent = t('chordDisplay.customVoicing');
        lastChordName = customText;
        // Debounce announcement
        chordDebounceTimer = setTimeout(() => {
            chordAnnouncementEl.textContent = customText;
        }, 300);
    } else {
        chordNameEl.style.fontSize = '4em';
        const chordFullName = `${chordInfo.root} ${chordInfo.type}`;
        chordNameEl.textContent = chordFullName;
        const pitchClasses = noteNames.map(getPitchClass);
        const uniquePitches = [...new Set(pitchClasses)];
        chordNotesEl.textContent = uniquePitches.join(' - ');
        lastChordName = chordFullName;
        // Debounce announcement - only announce after 300ms of no new notes
        chordDebounceTimer = setTimeout(() => {
            chordAnnouncementEl.textContent = chordFullName;
        }, 300);
    }
}

// Setup device selection
document.getElementById('midiInput').addEventListener('change', (e) => {
    selectInput(e.target.value);
});

// Setup settings
document.getElementById('showAllChords').addEventListener('change', updateDisplay);
document.getElementById('simplifyChords').addEventListener('change', updateDisplay);

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = '../../';
});

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await initI18n();
    initMIDI();
});
