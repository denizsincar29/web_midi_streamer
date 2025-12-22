# iReal Pro Maker - Future Enhancement Tasks

This document outlines future enhancements and features for the iReal Pro Maker tool that are beyond the scope of the current accessibility fixes.

## 1. Internationalization (i18n)

### Goal
Implement full internationalization support with Russian and English language files.

### Requirements
- Create `russian.json` and `english.json` language files for all UI strings
- Extract all hardcoded strings from the HTML/JavaScript into language files
- Implement language switching mechanism
- Add language selection UI (possibly in settings modal)

### Terminology Research Needed
Look up and decide on proper terminology for:
- **App name options:**
  - Russian: "редактор цифровок iReal Pro" (iReal Pro chord notation editor)
  - English: "iReal Pro Chord Progression Editor"
  - Alternative: Something simpler and more memorable
  
- **Key terms to translate:**
  - Measure, beat, chord, section, volta ending
  - All keyboard shortcuts descriptions
  - All modal dialog content
  - Status messages and announcements
  - Error messages

### Implementation Notes
- Use a translation function like `t(key)` throughout the codebase
- Consider using established i18n libraries (e.g., i18next)
- Ensure screen reader announcements are properly translated
- Test with both languages to ensure proper layout/spacing

---

## 2. MIDI Playback Feature

### Goal
Implement chord playback using MIDI output by converting chord symbols back to individual notes.

### Chord-to-Notes Conversion Algorithm
For each chord symbol, generate MIDI notes with specific voicing rules:

1. **Root note:** Place in 2nd octave (MIDI notes 36-47, C2-B2)

2. **Third and Seventh:** Place in 3rd octave (E3 to G4, MIDI notes 52-67)
   - For maj7, m7, 7, etc.: include the seventh
   - For triads: include the third (and fifth if needed)

3. **Upper extensions:** Add these above the basic triad+7th structure
   - **Ninth (9):** One octave above root
   - **Eleventh (11):** If specified
   - **Thirteenth (13):** If specified

4. **Voicing flexibility:** 
   - Can start with 7th and upper 3rd if needed for better voice leading
   - Avoid awkward intervals
   - Keep notes within comfortable range (E3 to G4 for middle voices)

### Technical Implementation
- Find or create the JavaScript file that recognizes chord symbols
- Add reverse translation: chord symbol → note array
- Handle various chord types:
  - Major, minor, diminished, augmented
  - 7th chords (maj7, m7, 7, m7b5, dim7)
  - Extensions (9, 11, 13)
  - Alterations (b9, #9, #11, b13)
  - Sus chords (sus2, sus4)
- Send MIDI note-on/note-off messages to selected MIDI output device
- Implement playback timing based on tempo and beat positions
- Add controls: play, pause, stop, tempo adjustment

### User Experience
- Playback should highlight current chord/measure
- Visual feedback on workspace during playback
- Option to loop sections
- Respect start/end markers for partial playback

---

## 3. Keyboard Shortcuts Enhancement

### Current Issue
- **H key** currently toggles keyboard shortcuts help visibility
- Need distinction between viewing shortcuts and interactive help

### Proposed Change

#### Shift+H: Display Keyboard Shortcuts
- Shows the existing keyboard shortcuts reference panel
- Static display of all available shortcuts
- Current implementation (already working)

#### H key: Input Help Mode (NEW)
- Toggle an interactive help mode
- When active: Press any key to hear what that key does
- Screen reader announces the key's function without executing it
- Similar to JAWS/NVDA keyboard help mode
- Press H again or Escape to exit help mode

### Implementation Details
- Add `isInputHelpMode` boolean flag
- When enabled, intercept all keydown events
- Announce the key's function via `announceChange()`
- Prevent the key's normal action from executing
- Show visual indicator that help mode is active
- All announcements must be internationalized

### i18n for Input Help
Each key's description should come from language files:
```json
{
  "inputHelp": {
    "h": "Toggle input help mode",
    "n": "Focus workspace for chord editing",
    "t": "Open tempo settings",
    "m": "Select MIDI devices",
    "space": "Play or pause playback",
    // ... etc
  }
}
```

---

## 4. Service Worker Caching

### Goal
Make the iReal Pro Maker tool work offline with service worker caching.

### Requirements
- Update or create `service-worker.js` for the tools directory
- Cache all static assets:
  - HTML file
  - CSS styles
  - JavaScript code
  - Any referenced images/icons
- Implement appropriate cache strategy:
  - Cache-first for static assets
  - Network-first for dynamic data
- Handle cache updates/versioning
- Test offline functionality

### Testing Needed
- Test in various browsers (Chrome, Firefox, Safari, Edge)
- Verify offline loading works
- Test cache updates when files change
- Ensure no issues with MIDI API (requires online)
- Test on mobile devices

---

## 5. Beat Quantization Improvements

### Current Issue
Beat calculation of recorded chords doesn't properly estimate the nearest beat. For example, if a chord is pressed slightly before beat 1 of measure 2, it should be quantized to M2:B1.

### Requirements
- Improve MIDI timing algorithm to snap to nearest beat
- Consider timing tolerance (e.g., within 100ms of beat)
- Option to adjust quantization strength (none, light, strong)
- Visual feedback during recording showing quantization
- Option to disable quantization for free-time recording

### Implementation
- Add beat quantization logic to MIDI input handler
- Calculate which beat is closest based on timestamp
- Add user preference for quantization settings
- Consider "swing" timing for jazz feels
- Allow manual adjustment after recording

---

## 6. Chord Beat Movement Feature

### Goal
Add keyboard combination to move a chord from one beat to another within measures.

### Requirements
- Implement key combination (e.g., Alt+Left/Right or Ctrl+Shift+Left/Right)
- Move selected chord between beats:
  - From beat 4 to beat 3
  - From measure 2 beat 1 to measure 1 beat 4
- Update chord's beat property
- Refresh display after move
- Announce move to screen reader
- Maintain chord ordering in data structure

### Edge Cases
- Moving to occupied beat: warn user or swap/shift chords
- Moving across measure boundaries
- Moving first/last chord in sequence
- Undo/redo support

---

## Implementation Priority

Suggested order of implementation:
1. **Input Help Mode (H key)** - Small enhancement, improves accessibility
2. **i18n foundation** - Set up structure, easier to add features with i18n in place
3. **Service Worker** - Improves offline experience
4. **Beat Quantization** - Improves recording accuracy
5. **Chord Movement** - Advanced editing feature
6. **MIDI Playback** - Complex feature, requires significant work

---

## Notes

- Each task should be implemented in a separate PR
- All features must maintain screen reader accessibility
- Comprehensive testing required for each feature
- Update documentation/help as features are added
- Consider user preferences/settings for new features
