# iRealPro Maker - Deprecated

> **⚠️ DEPRECATED**: This tool is no longer actively maintained and will be rewritten in Go for better performance and maintainability.

## Tool Overview

The iRealPro Maker is a web-based MIDI mini app that allows musicians to create iRealPro chord charts by recording chord progressions from their MIDI keyboard or controller.

## Functionality Description

### Core Features

1. **Real-time Chord Detection**
   - Detects chords played on MIDI keyboard using intelligent chord recognition algorithm
   - Supports 70+ chord types including:
     - Major, minor, diminished, augmented
     - 7th chords (major 7, dominant 7, minor 7, half-diminished 7, diminished 7)
     - Extended chords (9th, 11th, 13th)
     - Altered chords with #5, b5, #9, b9, #11, b13
     - Suspended chords (sus2, sus4)
     - Add chords (add9, add11, add13)
   - Automatic inversion detection (root position, 1st, 2nd, 3rd inversions)

2. **Metronome and Count-in**
   - Configurable tempo (BPM) from 40 to 240
   - Multiple time signatures: 4/4, 3/4, 5/4, 6/8, 7/8, 2/4
   - 2-measure count-in before recording starts
   - Audio metronome clicks with accent on beat 1
   - Visual beat indicator

3. **Chord Recording and Editing**
   - Records chords with measure and beat position
   - Automatic quantization to nearest beat (25% tolerance window)
   - Multiple chords per measure support
   - Keyboard shortcuts for efficient editing:
     - Arrow keys: Navigate between chords
     - Backspace: Delete current chord
     - E: Edit chord via MIDI input
     - Alt+Arrow: Move chord between beats
     - Ctrl+Arrow: Jump to next/previous measure with chords
     - [ and ]: Set recording start/end markers

4. **Section Management**
   - Define song sections (A, B, C, D, Intro, Outro, Verse, Chorus, Bridge, Coda)
   - Visual section markers in chord grid
   - Section-based navigation (Ctrl+Shift+Arrow keys)
   - Copy chords from previous section
   - Delete entire sections with Shift+Backspace

5. **Repeat Structure Support**
   - Automatic volta (ending) detection with "V" key
   - Smart repeat structure creation:
     - Detects reprise sections
     - Creates first and second endings automatically
     - Matches section lengths for intelligent pairing
   - Manual volta placement and editing
   - Visual volta markers (VOLTA 1, VOLTA 2)

6. **iRealPro Export**
   - Generates valid iRealPro custom URL format
   - Supports all iRealPro chord notations:
     - Root notes with accidentals (C, C#, Db, etc.)
     - Chord qualities and extensions
     - Inversions (slash chords)
   - Encoding for safe URL sharing
   - Includes song metadata:
     - Song name
     - Composer/author
     - Music style (Swing, Ballad, Latin, etc.)
     - Key signature
     - Time signature

7. **Progress Management**
   - Save/load songs to browser local storage
   - Export progress as JSON file
   - Import progress from JSON file
   - Multiple saved songs with timestamps
   - Auto-save before closing with Shift+W

8. **Accessibility Features**
   - Full keyboard navigation
   - Screen reader support with live announcements
   - Input help mode (H key) - announces key functions
   - High contrast visual indicators
   - ARIA labels and roles throughout

9. **MIDI Playback**
   - Play back recorded chord progression with metronome
   - Visual chord highlighting during playback
   - Spacebar to play/pause
   - Select MIDI output device for chord playback

10. **Clipboard Operations**
    - Cut, copy, paste chord ranges
    - Marker-based range selection with [ and ] keys
    - Ctrl+X, Ctrl+C, Ctrl+V shortcuts

### Technical Implementation

- **Frontend**: Pure JavaScript ES6 modules
- **MIDI Integration**: Web MIDI API for keyboard input and playback
- **Audio**: Web Audio API for metronome clicks
- **Chord Detection**: Custom algorithm analyzing note sets against chord templates
- **Data Format**: JSON for progress files, iRealPro URL format for export
- **Storage**: Browser localStorage for persistent saves
- **Internationalization**: Multi-language support (English, Russian)

### File Structure

- `irealb-maker.html` - Main application file (3900+ lines)
  - Complete standalone HTML application
  - Embedded CSS styles
  - JavaScript modules imported from parent directory
  - Modal dialogs for song setup, tempo, MIDI device selection
  - Keyboard shortcut help system

### Dependencies

- `../src/i18n.js` - Internationalization system
- `../src/chord-utils.js` - Chord detection and MIDI note utilities
- `../style.css` - Shared styles

### Keyboard Shortcuts Reference

- **H**: Input help mode (announces key functions)
- **Shift+H**: Show/hide keyboard shortcuts
- **N**: Focus on workspace
- **T**: Open tempo settings
- **M**: Open MIDI device selection
- **R**: Start/stop recording
- **E**: Edit chord via MIDI
- **S**: Add section marker
- **V**: Add volta (automatic repeat detection)
- **Shift+V**: Delete marker at cursor
- **Backspace**: Delete current chord
- **Delete**: Delete marker range
- **Shift+Backspace**: Delete entire section
- **[**: Set start recording marker
- **]**: Set end recording marker
- **Arrow keys**: Navigate chords
- **Ctrl+Arrow**: Jump measures
- **Alt+Arrow**: Move chord between beats
- **Spacebar**: Play/pause playback
- **Ctrl+X/C/V**: Cut/copy/paste
- **Shift+S**: Save to local storage
- **Shift+O**: Open from local storage
- **Shift+D**: Download iReal file
- **Shift+J**: Download/load JSON
- **Shift+W**: Close with save prompt
- **Esc**: Cancel/exit modes

## Why Deprecated?

This JavaScript implementation has served its purpose as a proof of concept and initial release. However, there are several reasons for deprecation:

1. **Performance**: Large JavaScript file size (3900+ lines in single HTML file)
2. **Maintainability**: Complex state management mixed with UI code
3. **Scalability**: Difficult to add new features without increasing complexity
4. **Testing**: Limited automated testing capabilities
5. **Code Organization**: Monolithic structure makes refactoring difficult

## Future: Go Implementation

The tool will be rewritten in Go with the following improvements:

- **Better Architecture**: Separation of concerns (backend logic, frontend UI)
- **Performance**: Native performance for chord detection and data processing
- **API-based**: RESTful API for chord operations
- **Modern Frontend**: Separate frontend framework for better UX
- **Testing**: Comprehensive unit and integration tests
- **Deployment**: Standalone binary for easy self-hosting

## Current Status

- **Functional**: The tool works as intended for its original purpose
- **Supported**: No new features will be added
- **Bug Fixes**: Critical bugs may be fixed on a case-by-case basis
- **Access**: Tool remains accessible at `tools/deprecated/irealb-maker.html`

## For Users

If you are using the iRealPro Maker:

1. You can continue using the current version
2. Export your progress as JSON files regularly (Shift+J)
3. The JSON format will be compatible with the new Go version
4. Watch for announcements about the Go version release

## For Developers

If you need to maintain or understand this code:

1. Read the inline comments in `irealb-maker.html`
2. Review the chord detection algorithm in `../src/chord-utils.js`
3. The iRealPro format documentation is in `../IReal docs.md`
4. Test with various MIDI keyboards for compatibility

## Related Documentation

- [IReal Pro URL Format](../../IReal%20docs.md)
- [Chord Detection Utils](../../src/chord-utils.js)
- [Main MIDI Streamer](../../README.md)

---

*Last updated: 2026-01-01*
*Deprecated in version: 1.2*
