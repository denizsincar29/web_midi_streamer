# iRealb Maker - Bug Fix Verification Guide

## How to Test the Fixes

This guide will help you verify that all bug fixes are working correctly.

### Prerequisites
- A MIDI keyboard/controller connected to your computer
- A web browser (Chrome, Edge, or Firefox recommended for Web MIDI API support)
- Open `tools/irealb-maker.html` in your browser

---

## Test 1: Major Sixth Chords (Bug #1) ✅ Already Working

**Expected Result:** Sixth chords should be correctly recognized

**Steps:**
1. Connect your MIDI keyboard
2. Open the iRealb Maker app
3. Set up a new song (any name, 4/4 time, 32 measures)
4. Start recording
5. Play these chords on your keyboard:
   - **C6**: C-E-G-A (root, major 3rd, 5th, 6th)
   - **F6**: F-A-C-D
   - **G6**: G-B-D-E
   - **C6/9**: C-E-G-A-D (adds the 9th)

**Verification:**
- C6 should appear as "C6" in the display
- F6 should appear as "F6"
- G6 should appear as "G6"
- C6/9 should appear as "C6/9"

**Status:** ✅ This was already working correctly

---

## Test 2: Multiple Chords Per Measure (Bug #2) ✅ Fixed

**Expected Result:** All chords recorded in a measure should be visible

**Steps:**
1. Set up a new song in 4/4 time
2. Start recording
3. In the first measure:
   - On beat 1: Play C major (C-E-G)
   - On beat 3: Play F major (F-A-C)
4. Stop recording

**Verification:**
- You should see TWO separate cells for measure 1:
  - First cell: "M1" with chord "C"
  - Second cell: "M1(2)" with chord "F" (should have orange left border)
- Both cells should be clickable and selectable
- You should be able to navigate between them with arrow keys

**What was broken before:**
- Only the first chord (C) would be visible
- The second chord (F) was recorded but hidden
- You couldn't select, edit, or delete the second chord

**Visual Indicators:**
- First chord in measure: Normal styling
- Additional chords: Orange left border, light yellow background

---

## Test 3: Metronome/Playback Timing (Bug #3) ⚠️ Needs Testing

**Expected Result:** The accent (high-pitched click) should happen on beat 1, not beat 2

**Steps:**
1. Set BPM to 120 (or your preference)
2. Start recording
3. Count along with the metronome during count-in
4. The HIGH-pitched click should align with "ONE"

**Verification:**
- Beat 1: HIGH click (accent) - should be on "ONE"
- Beat 2: normal click - should be on "two"
- Beat 3: normal click - should be on "three"
- Beat 4: normal click - should be on "four"
- Next measure starts with HIGH click on "ONE" again

**Test at different tempos:**
- 60 BPM (slow)
- 120 BPM (medium)
- 180 BPM (fast)
- 240 BPM (very fast)

**Additional Playback Test:**
1. Record a few chords
2. Press Spacebar to start playback
3. Listen to the metronome clicks
4. Verify the accent is on beat 1 of each measure

**What to report if broken:**
- "Accent plays on beat [X] instead of beat 1"
- Note the BPM where you noticed the issue

---

## Test 4: Deletion of Chords (Bug #4) ✅ Fixed

**Expected Result:** Proper error messages when trying to delete empty measures

### Test 4a: Delete Empty Measure

**Steps:**
1. Set up a new song with 32 measures
2. Record a chord in measure 1
3. Navigate to measure 2 (which is empty)
4. Press Backspace

**Verification:**
- Should hear announcement: "Cannot delete: empty measure"
- No crash or silent failure

**What was broken before:**
- Trying to delete empty measure would call `deleteChord(NaN)`
- Silent failure with no feedback

### Test 4b: Delete Multiple Chords in Same Measure

**Steps:**
1. Record two chords in measure 1 (C at beat 1, F at beat 3)
2. Navigate to the first chord cell (M1 with C)
3. Press Backspace to delete C
4. Confirm deletion
5. Verify F chord is still there
6. Navigate to F chord cell (M1 with F)
7. Press Backspace to delete F
8. Confirm deletion

**Verification:**
- Both chords can be deleted individually
- After deleting C, the F chord remains visible
- After deleting F, measure 1 becomes empty

**What was broken before:**
- Only the first chord (C) was accessible
- The second chord (F) couldn't be selected or deleted

### Test 4c: Delete Chord with Markers

**Steps:**
1. Record chords in measures 1-4
2. Navigate to measure 2
3. Press `[` to set START marker
4. Navigate to measure 3
5. Press `]` to set END marker
6. Navigate to measure 2 (with START marker)
7. Press Backspace to delete the chord

**Verification:**
- Chord should be deleted successfully
- Markers should remain intact

---

## Test 5: Visual Verification of Multi-Chord Display

**Steps:**
1. Record a song with varied chord patterns:
   - Measure 1: C (single chord)
   - Measure 2: D, G (two chords)
   - Measure 3: E, A, D (three chords)
   - Measure 4: Empty (no chords)

**Verification:**
- Measure 1: One cell labeled "M1" with "C"
- Measure 2: Two cells:
  - "M2" with "D" (normal styling)
  - "M2(2)" with "G" (orange border, yellow background)
- Measure 3: Three cells:
  - "M3" with "E" (normal styling)
  - "M3(2)" with "A" (orange border)
  - "M3(3)" with "D" (orange border)
- Measure 4: One cell labeled "M4" with "—" (dashed border, grayed out)

**Navigation:**
- Arrow keys should navigate through ALL cells
- Each cell should be selectable
- Pressing `E` on any cell should allow editing that specific chord

---

## Summary Checklist

Use this checklist to track your testing:

- [ ] Bug #1: Tested C6, F6, G6, C6/9 - all recognized correctly
- [ ] Bug #2: Multiple chords per measure all visible
- [ ] Bug #2: Orange border on subsequent chords
- [ ] Bug #2: Can navigate between chords with arrow keys
- [ ] Bug #2: Can edit each chord individually
- [ ] Bug #2: Can delete each chord individually
- [ ] Bug #3: Metronome accent on beat 1 (not beat 2)
- [ ] Bug #3: Tested at multiple tempos (60, 120, 180 BPM)
- [ ] Bug #3: Playback timing sounds correct
- [ ] Bug #4: Empty measure deletion shows error message
- [ ] Bug #4: Can delete multiple chords in same measure
- [ ] Bug #4: Deletion with markers works correctly

---

## Reporting Issues

If you find any issues during testing, please report:

1. **Which test failed:** (e.g., "Test 2 - Multiple Chords")
2. **Expected behavior:** What should have happened
3. **Actual behavior:** What actually happened
4. **Steps to reproduce:** Exact steps that cause the issue
5. **Browser and OS:** e.g., "Chrome 120 on Windows 11"
6. **Console errors:** Open browser DevTools (F12) and check for errors

---

## Notes for Screen Reader Users

All fixes maintain screen reader compatibility:

- Empty measure deletion announces the error message
- Multiple chords per measure are announced with their position
- Navigation with arrow keys announces each chord
- Measure labels include position number for clarity

Example announcements:
- "C major measure 1"
- "F major measure 1, beat 3" (for second chord in measure)
- "Cannot delete: empty measure" (for empty measure deletion)
