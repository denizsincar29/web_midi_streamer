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
    } else if (has(9) && !has(10) && !has(11)) {
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
