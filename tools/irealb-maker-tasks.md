# iReal Pro Maker - Future Enhancement Tasks

This document outlines future enhancements and features for the iReal Pro Maker tool.

## 1. Volta/Repeat System (iRealPro Format)

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

The IRealPro format is located at https://www.irealpro.com/ireal-pro-custom-chord-chart-protocol

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

## 2. Bug Fixes

### Bug: Chord Recognition - Major Sixth Chords ✅ TESTED - WORKING
**Status:** Already Fixed

**Test Results (Dec 22, 2024):**
- ✅ C6 chord correctly detected as `{ root: 'C', type: '6' }`
- ✅ F6 chord correctly detected as `{ root: 'F', type: '6' }`
- ✅ G6 chord correctly detected as `{ root: 'G', type: '6' }`
- ✅ C6/9 chord correctly detected as `{ root: 'C', type: '6/9' }`

**Analysis:** The sixth detection logic in `chord-utils.js` (lines 109-122) correctly:
- Checks for interval 9 (major sixth)
- Verifies no seventh is present (intervals 10 or 11)
- Differentiates between major and minor sixth chords
- Handles sixth with ninth (6/9) properly

**Conclusion:** This bug has already been fixed. No further action required.

---

### Bug: Multiple Chords Per Measure Still Missing Some ✅ FIXED
**Status:** Fixed on Dec 22, 2024

**Root Cause Identified:**
The display logic in `tools/irealb-maker.html` (line 938) only showed the first chord in each measure:
```javascript
const item = chordsInMeasure[0]; // Use first chord for display
```
This meant additional chords in the same measure were recorded but invisible and inaccessible.

**Fix Applied:**
- Modified `updateChordList()` to display ALL chords in each measure
- Each chord now gets its own cell in the grid
- Added visual styling: orange left border for additional chords
- Updated measure labels to show position: "M5(2)" for second chord in measure 5
- All chords are now individually selectable, navigable, and deletable

**Test Case:**
Record two or more chords in the same measure (e.g., C at beat 1, F at beat 3). All chords should now be visible as separate cells with distinct styling.

---

### Bug: Metronome/Playback Timing Offset ⚠️ NEEDS MANUAL TESTING
**Status:** Code Review Complete - Appears Correct

**Analysis (Dec 22, 2024):**
Reviewed both recording metronome and playback timing logic:

**Recording Metronome (`startMetronome`):**
- Beat sequence: 0 → 1 (accent) → 2 → 3 → 4 → reset to 1 (accent)
- Logic appears correct: accent plays on beat 1

**Playback (`togglePlayback`):**
- Initial: playbackBeat = 1, immediate accent click + first chord
- Interval callbacks: increment beat, play click, play chord on beat 1
- Logic appears correct: accent on beat 1 of each measure

**Potential Issues:**
- `setInterval` can drift over time (cumulative timing errors)
- No compensation for callback execution time
- Consider Web Audio API scheduling with `context.currentTime` for better precision

**Recommendation:**
Manual testing needed to verify if timing offset still exists. Test at various BPMs (60, 120, 180, 240) and compare with external metronome.

---

### Bug: deletion of some chords or marked positions fail at unknown places ✅ FIXED
**Status:** Fixed on Dec 22, 2024

**Root Causes Identified:**

**Root Causes Identified:**

1. **Empty Measure Deletion:**
   - Empty measures have no `data-index` attribute
   - Attempting to delete resulted in `deleteChord(parseInt(null))` → `deleteChord(NaN)`
   - Accessing `recordedChords[NaN]` returns `undefined`
   - Silent failure with no user feedback

2. **Multiple Chords Per Measure:**
   - Only first chord in measure was displayed (see Bug #2 above)
   - Additional chords were recorded but hidden/inaccessible
   - Could not delete chords that weren't visible

**Fix Applied:**
- Added validation in Backspace key handler (lines 1166-1182):
  - Check if `data-index` is null or empty
  - Validate `parseInt` result for NaN
  - Provide clear user feedback: "Cannot delete: empty measure"
- Multi-chord display fix (Bug #2) makes all chords accessible for deletion

**Test Cases:**
1. Try to delete empty measure → Should show "Cannot delete: empty measure"
2. Record multiple chords in same measure → All should be deletable individually
3. Delete chord with markers (START/END) → Should work correctly

---

## Summary of Bug Fixes (Dec 22, 2024)

| Bug | Status | Fix Applied |
|-----|--------|-------------|
| Major Sixth Chords | ✅ Already Fixed | None needed - verified working correctly |
| Multiple Chords Per Measure | ✅ Fixed | Display all chords; added visual styling |
| Metronome Timing Offset | ⚠️ Needs Testing | Code looks correct; manual test required |
| Deletion Failures | ✅ Fixed | Added validation; improved error messages |

All code changes made to `tools/irealb-maker.html`. The `chord-utils.js` file required no changes as sixth chord detection was already working correctly.

