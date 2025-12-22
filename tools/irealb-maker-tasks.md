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

### Bug: deletion of some chords or marked positions fail at unknown places
**Issue:** When deleting chords or marked positions, some entries are not removed as expected.
**Investigation Needed:**
- Review deletion logic in chord/position management code
- Check for edge cases where references are not properly cleared
- Add logging to track deletion attempts and failures
**Possible Causes:**
- Improper indexing in data structures
- Race conditions during concurrent edits
- UI not updating to reflect deletions
**Fix Required:**
- Ensure all references to deleted chords/positions are removed
- Update UI state after deletions
- Add test cases for deletion scenarios


