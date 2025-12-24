/**
 * Common chord detection utilities for MIDI mini apps
 * Shared between Chord Display and iRealPro Maker
 */

// MIDI note number to note name mapping (using flats by default for jazz notation)
export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Convert MIDI note number to note name with octave
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {string} Note name with octave (e.g., "C4", "Db3")
 */
export function midiNoteToName(midiNote) {
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = NOTE_NAMES[midiNote % 12];
    return noteName + octave;
}

/**
 * Extract pitch class from note name (remove octave number)
 * @param {string} noteName - Note name with octave (e.g., "C4")
 * @returns {string} Pitch class (e.g., "C")
 */
export function getPitchClass(noteName) {
    return noteName.replace(/[0-9]/g, '');
}

/**
 * Convert note name to semitone value (0-11)
 * @param {string} noteName - Pitch class (e.g., "C", "Db")
 * @returns {number} Semitone value (0-11)
 */
export function noteNameToSemitone(noteName) {
    const NOTE_VALUES = {
        'C': 0, 
        'C#': 1, 'Db': 1,
        'D': 2, 
        'D#': 3, 'Eb': 3,
        'E': 4, 
        'F': 5,
        'F#': 6, 'Gb': 6,
        'G': 7, 
        'G#': 8, 'Ab': 8,
        'A': 9, 
        'A#': 10, 'Bb': 10,
        'B': 11
    };
    return NOTE_VALUES[noteName] || 0;
}

/**
 * Detect chord from array of note names
 * Uses jazz theory conventions - bass note is always the lowest note
 * @param {string[]} noteNames - Array of note names with octaves (e.g., ["C4", "E4", "G4"])
 * @returns {object|null} Chord info with root and type, or null if single note/no chord
 */
export function detectChord(noteNames) {
    if (noteNames.length < 2) {
        return noteNames.length === 1 ? { root: getPitchClass(noteNames[0]), type: '' } : null;
    }
    
    // Get pitch classes (notes without octaves)
    const pitchClasses = noteNames.map(getPitchClass);
    
    // Remove duplicates
    const uniquePitches = [...new Set(pitchClasses)];
    
    if (uniquePitches.length < 2) {
        return { root: uniquePitches[0], type: '' };
    }
    
    // Bass note is always the first note (lowest)
    const root = uniquePitches[0];
    const rootValue = noteNameToSemitone(root);
    
    // Create interval set from root
    const intervalSet = new Set();
    uniquePitches.forEach(note => {
        const value = noteNameToSemitone(note);
        const interval = (value - rootValue + 12) % 12;
        intervalSet.add(interval);
    });
    
    // Helper function to check if interval exists
    const has = (interval) => intervalSet.has(interval);
    
    // Step 1: Identify base chord quality
    let baseChord = '';
    let thirdType = null; // null, 'major' (4), or 'minor' (3)
    let seventhType = null; // null, 'maj7' (11), 'dom7' (10)
    
    // Check for third
    if (has(4)) {
        thirdType = 'major';
    } else if (has(3)) {
        thirdType = 'minor';
    }
    
    // Check for seventh
    if (has(11)) {
        seventhType = 'maj7';
    } else if (has(10)) {
        seventhType = 'dom7';
    }
    
    // Check for sixth chord early (before base chord determination)
    // Sixth chords have interval 9 (major 6th) and no seventh
    if (has(9) && !has(10) && !has(11)) {
        // Sixth chord (no seventh)
        if (thirdType === 'major') {
            if (has(2)) {
                return { root, type: '6/9' };
            }
            return { root, type: '6' };
        } else if (thirdType === 'minor') {
            if (has(2)) {
                return { root, type: 'm6/9' };
            }
            return { root, type: 'm6' };
        }
    }
    
    // Determine base chord
    if (thirdType === 'major' && seventhType === 'dom7') {
        baseChord = '7';
    } else if (thirdType === 'major' && seventhType === 'maj7') {
        baseChord = 'maj7';
    } else if (thirdType === 'minor' && seventhType === 'dom7') {
        baseChord = 'm7';
    } else if (thirdType === 'minor' && seventhType === 'maj7') {
        baseChord = 'mM7'; // minor-major 7
    } else if (thirdType === 'major' && !seventhType) {
        baseChord = '';  // Major triad - no suffix
    } else if (thirdType === 'minor' && !seventhType) {
        baseChord = 'm';
    } else if (has(3) && has(6) && !has(7) && has(10)) {
        // Half-diminished: minor 3rd, b5, minor 7th (no perfect 5th)
        return { root, type: 'ø7' };
    } else if (has(3) && has(6) && !has(7) && has(9)) {
        // Diminished 7th: minor 3rd, b5, dim7 (no perfect 5th)
        return { root, type: 'dim7' };
    } else if (has(3) && has(6) && !has(7)) {
        // Diminished triad: minor 3rd, b5 (no perfect 5th)
        return { root, type: 'dim' };
    } else if (has(4) && has(8)) {
        // Augmented
        return { root, type: 'aug' };
    } else if (has(5) && has(7)) {
        // Sus4 variations
        if (has(10)) {
            baseChord = '7sus4';
            // Check for b9 in sus4
            if (has(1)) {
                return { root, type: '7sus4(b9)' };
            }
            return { root, type: baseChord };
        }
        return { root, type: 'sus4' };
    } else if (has(2) && has(7) && !has(3) && !has(4)) {
        // Sus2 (only if no third)
        if (has(10)) {
            return { root, type: '7sus2' };
        }
        return { root, type: 'sus2' };
    } else {
        // Unknown chord structure
        return { root, type: 'Custom', notes: uniquePitches };
    }
    
    // Step 2: Check for alterations and extensions
    const extensions = [];
    
    // Check for 9th alterations
    if (has(1)) {
        extensions.push('b9');
    } else if (has(3) && thirdType === 'major') {
        // #9 (only if we already have major 3rd, otherwise 3 is the third itself)
        extensions.push('#9');
    } else if (has(2) && (baseChord === '7' || baseChord === 'maj7' || baseChord === 'm7' || baseChord === 'mM7')) {
        // Natural 9
        if (!has(1) && !has(3)) { // Make sure it's not already counted as b9 or #9
            extensions.push('9');
        }
    }
    
    // Check for #11
    // Only treat interval 6 as #11 if there's also a perfect 5th (to distinguish from b5/diminished)
    if (has(6) && has(7)) {
        extensions.push('#11');
    }
    
    // Check for 13th
    if (has(9) && (baseChord === '7' || baseChord === 'maj7' || baseChord === 'm7')) {
        extensions.push('13');
    } else if (has(8) && (baseChord === '7' || baseChord === 'maj7')) {
        extensions.push('b13');
    }
    
    // Build final chord name
    let chordName = baseChord;
    
    // If we have a 9, and it's a dominant chord, we might want to call it "9" instead of "7(9)"
    if (baseChord === '7' && extensions.includes('9') && !extensions.includes('b9') && !extensions.includes('#9')) {
        // If only natural 9, call it "9" chord
        if (extensions.length === 1 || (extensions.length === 2 && extensions.includes('13'))) {
            chordName = '9';
            extensions.shift(); // Remove the '9' from extensions
        }
    }
    
    // Similarly for 13
    if (baseChord === '7' && extensions.includes('13')) {
        // If we have 13, call it "13" chord
        chordName = '13';
        const idx = extensions.indexOf('13');
        extensions.splice(idx, 1);
    }
    
    // Add extensions to chord name
    if (extensions.length > 0) {
        chordName += '(' + extensions.join(',') + ')';
    }
    
    return { root, type: chordName };
}

/**
 * Convert chord symbol to MIDI note numbers for playback
 * Uses jazz voicing conventions:
 * - Root in 2nd octave (C2-B2, MIDI 36-47)
 * - Third and seventh in 3rd-4th octave (G3-A4, MIDI 55-69)
 * - Extensions above the basic structure
 * - Order: Root, (3rd or sus), 7th, extensions (9, 11, 13)
 * - Fifth is omitted on dominant 7th chords, included on minor 7th
 * 
 * @param {object} chord - Chord object with root and type
 * @param {string} inversion - Optional bass note for slash chords
 * @returns {number[]} Array of MIDI note numbers
 */
export function chordToMIDINotes(chord, inversion = null) {
    if (!chord || !chord.root) {
        return [];
    }
    
    const rootNote = chord.root;
    const chordType = chord.type || '';
    
    // Base octave for root note (C2 = MIDI 36)
    const rootOctave = 2;
    const rootMIDI = noteNameToSemitone(rootNote) + (rootOctave + 1) * 12;
    
    const notes = [rootMIDI]; // Always start with root
    
    // Helper to add note above root with specific octave placement
    const addInterval = (semitones, octaveOffset = 0) => {
        const note = rootMIDI + semitones + (octaveOffset * 12);
        notes.push(note);
    };
    
    // Parse chord type to determine intervals
    let hasThird = true;
    let hasFifth = true;
    let hasSeventh = false;
    let thirdInterval = 4; // Major third by default
    let fifthInterval = 7; // Perfect fifth by default
    let seventhInterval = null;
    
    // Determine basic chord structure
    if (chordType === '' || chordType === 'maj' || chordType.startsWith('maj7') || chordType === '6' || chordType === '6/9') {
        // Major chord
        thirdInterval = 4;
        if (chordType.includes('maj7')) {
            hasSeventh = true;
            seventhInterval = 11;
        } else if (chordType === '6' || chordType === '6/9') {
            // Use 6th instead of 7th
            hasSeventh = true;
            seventhInterval = 9;
        }
    } else if (chordType.startsWith('m') && !chordType.startsWith('maj')) {
        // Minor chord
        thirdInterval = 3;
        if (chordType.includes('7') || chordType.includes('9') || chordType.includes('11') || chordType.includes('13')) {
            hasSeventh = true;
            seventhInterval = chordType.includes('M7') || chordType.includes('maj7') ? 11 : 10;
        }
        if (chordType === 'm6' || chordType === 'm6/9') {
            hasSeventh = true;
            seventhInterval = 9;
        }
    } else if (chordType === '7' || chordType === '9' || chordType === '13') {
        // Dominant 7th - omit the fifth
        thirdInterval = 4;
        hasSeventh = true;
        seventhInterval = 10;
        hasFifth = false; // Omit fifth on dominant 7th
    } else if (chordType.includes('dim')) {
        // Diminished
        thirdInterval = 3;
        fifthInterval = 6;
        if (chordType === 'dim7') {
            hasSeventh = true;
            seventhInterval = 9; // Diminished 7th
        }
    } else if (chordType.includes('ø') || chordType === 'ø7') {
        // Half-diminished
        thirdInterval = 3;
        fifthInterval = 6;
        hasSeventh = true;
        seventhInterval = 10;
    } else if (chordType.includes('aug') || chordType === '+') {
        // Augmented
        thirdInterval = 4;
        fifthInterval = 8;
    } else if (chordType.includes('sus4')) {
        // Sus4 - no third, use 4th instead
        hasThird = false;
        // Note: Don't add fourth here, we'll add it along with the fifth
        if (chordType.includes('7')) {
            hasSeventh = true;
            seventhInterval = 10;
        }
    } else if (chordType.includes('sus2')) {
        // Sus2 - no third, use 2nd instead
        hasThird = false;
        // Note: Don't add second here, we'll add it along with the fifth
        if (chordType.includes('7')) {
            hasSeventh = true;
            seventhInterval = 10;
        }
    }
    
    // Voice the chord with proper octave placement
    // 3rd and 7th should be in the G3-A4 range (MIDI 55-69)
    // This means we need to add at least one octave to get into the right range
    
    // Add third (if present) OR suspended interval for sus chords
    // Place in upper octave (G3-A4 range)
    if (hasThird) {
        // Add octave to get into G3-A4 range
        const octaveAdjust = Math.floor((55 - (rootMIDI + thirdInterval)) / 12) + 1;
        addInterval(thirdInterval, octaveAdjust);
    } else if (chordType.includes('sus4')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + 5)) / 12) + 1;
        addInterval(5, octaveAdjust); // Perfect 4th (5 semitones) for sus4
    } else if (chordType.includes('sus2')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + 2)) / 12) + 1;
        addInterval(2, octaveAdjust); // Major 2nd (2 semitones) for sus2
    }
    
    // Add seventh (if present) - also in G3-A4 range
    if (hasSeventh && seventhInterval !== null) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + seventhInterval)) / 12) + 1;
        addInterval(seventhInterval, octaveAdjust);
    }
    
    // Add fifth (if present) - place between 3rd and 7th
    // Note: Fifth is omitted on dominant 7th chords, included on minor 7th
    if (hasFifth) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + fifthInterval)) / 12) + 1;
        addInterval(fifthInterval, octaveAdjust);
    }
    
    // Add extensions - place above 7th
    if (chordType.includes('9') || chordType === '6/9' || chordType === 'm6/9') {
        const octaveAdjust = Math.floor((55 - (rootMIDI + 2)) / 12) + 2; // Higher octave for extensions
        addInterval(2, octaveAdjust); // 9th = one octave above 2nd
    }
    
    if (chordType.includes('b9')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + 1)) / 12) + 2;
        addInterval(1, octaveAdjust); // Flat 9
    }
    
    if (chordType.includes('#9')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + 3)) / 12) + 2;
        addInterval(3, octaveAdjust); // Sharp 9
    }
    
    if (chordType.includes('11') || chordType.includes('#11')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + (chordType.includes('#11') ? 6 : 5))) / 12) + 2;
        addInterval(chordType.includes('#11') ? 6 : 5, octaveAdjust); // 11th or #11
    }
    
    if (chordType.includes('13')) {
        const octaveAdjust = Math.floor((55 - (rootMIDI + (chordType.includes('b13') ? 8 : 9))) / 12) + 2;
        addInterval(chordType.includes('b13') ? 8 : 9, octaveAdjust); // 13th or b13
    }
    
    // Handle inversion (bass note)
    if (inversion) {
        const bassNote = noteNameToSemitone(inversion) + (rootOctave) * 12; // One octave lower
        notes.unshift(bassNote);
    }
    
    // Ensure notes are unique and sorted
    const uniqueNotes = [...new Set(notes)].sort((a, b) => a - b);
    
    // Limit to reasonable range (MIDI 24-96, C1-C7)
    return uniqueNotes.filter(n => n >= 24 && n <= 96);
}
