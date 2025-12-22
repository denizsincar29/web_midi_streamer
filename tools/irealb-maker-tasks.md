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

## 7. Volta/Repeat System (iRealPro Format)

### Goal
Implement a full repeat/volta system compatible with iRealPro format where pressing V creates proper repeat signs and volta endings.

### Requirements

#### Research Phase
- **Research iRealPro format specification** for repeat/volta syntax
- Study how iRealPro encodes:
  - Repeat signs (start/end barlines)
  - First and second endings (volta brackets)
  - Section navigation with repeats
  - Hidden/implied repeated measures

#### Functionality
When user presses **V key** at a measure (e.g., measure 7 in a 32-measure AABA piece):

1. **Automatic Repeat Detection:**
   - Mark all measures from section start to V position as repeat section (reprise)
   - Example: Measures 1-6 become the repeat section
   - Measures 7-8 become first volta ending

2. **Second Volta Assignment:**
   - Find next section with same length as current section
   - Automatically assign corresponding measures as second volta
   - Example: In section B, measures 15-16 become second volta
   - Error if no matching section found

3. **Display Logic:**
   - Hide repeated measures in second occurrence
   - Show only volta endings that differ
   - Example: Section B displays only measures 7-8 (second volta), measures 1-6 are hidden

4. **Navigation:**
   - Arrow key navigation skips hidden repeated measures
   - From measure 8 (end of first volta), right arrow goes to measure 7 of second volta
   - Maintain logical measure numbering in announcements

5. **Playback:**
   - Play full section first time: reprise (1-6) + volta 1 (7-8)
   - On repeat: play reprise (1-6) + volta 2 (15-16)
   - Natural musical flow with proper repeat behavior

#### Data Structure Changes
- Add repeat markers to sections
- Track volta positions with type (1st/2nd ending)
- Map hidden measures to their source measures
- Update iRealPro export format with proper repeat syntax

#### Implementation Notes
- This is a major architectural change
- Requires careful planning and testing
- Must maintain backward compatibility with existing files
- All screen reader announcements must reflect repeat structure

---

## 8. Bug Fixes

### Bug: Chord Recognition - Major Sixth Chords
**Issue:** Major chords with sixth (e.g., C6) are not properly recognized.

**Root Cause:** The sixth detection logic may have conflicts with other chord type checks.

**Fix Required:**
- Review chord detection algorithm in `chord-utils.js`
- Ensure major sixth (interval 9) is properly detected when:
  - Has major third (interval 4)
  - Has sixth (interval 9)
  - No seventh present (intervals 10 or 11)
- Add test cases for: C6, F6, G6, C6/9, etc.

---

### Bug: Multiple Chords Per Measure Still Missing Some
**Issue:** Even after the fix in commit 359ce86, some chords are still not recorded when multiple chords are played in a measure.

**Investigation Needed:**
- Check if the position-based recording logic has edge cases
- Verify beat quantization doesn't cause collisions
- Test rapid chord changes within a beat
- Review timing thresholds for chord detection

**Possible Causes:**
- Quantization snapping multiple chords to same beat
- Insufficient delay between chord releases
- Beat calculation rounding errors

---

### Bug: Metronome/Playback Timing Offset
**Issue:** During playback, the metronome tick and beat announcement are not synchronized correctly. High tick (beat 1) plays on second beat instead of first beat.

**Symptoms:**
- Metronome ticking one beat late
- Beat announcements delayed or at wrong time
- Should tick at start of beat, not end

**Root Cause Investigation:**
- Review playback interval timing
- Check when `playClick()` is called relative to chord playback
- Verify beat counter initialization
- Examine interval scheduling (setInterval vs. setTimeout with drift correction)

**Fix Required:**
- Ensure metronome tick happens at beat start
- Synchronize chord playback with beat clicks
- Use high-resolution timing for accurate playback
- Consider using Web Audio API scheduling for precise timing

---

## Implementation Priority

Suggested order of implementation:
1. **Input Help Mode (H key)** - ✅ COMPLETED
2. **i18n foundation** - ✅ COMPLETED
3. **Service Worker** - ✅ COMPLETED
4. **Beat Quantization** - ✅ COMPLETED
5. **Chord Movement** - ✅ COMPLETED
6. **MIDI Playback** - ✅ COMPLETED
7. **Bug Fixes** - IN PROGRESS (chord recognition, recording, timing)
8. **Volta/Repeat System** - FUTURE (requires iRealPro format research)

---

## Notes

- Each task should be implemented in a separate PR
- All features must maintain screen reader accessibility
- Comprehensive testing required for each feature
- Update documentation/help as features are added
- Consider user preferences/settings for new features
- iRealPro format research is critical for volta implementation
