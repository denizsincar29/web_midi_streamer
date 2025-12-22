# iReal Pro Maker - Future Enhancement Tasks

This document outlines future enhancements and features for the iReal Pro Maker tool.

## Volta/Repeat System (iRealPro Format)

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

