# MIDI Chimes Configuration

The `chimes.json` file allows you to customize the MIDI sounds that play for different status notifications.

## Configuration Format

Each chime type (success, error, warning, info, connecting) can be configured with either:

### 1. Note Sequence (Simple)

Play a sequence of notes specified by name:

```json
{
  "success": {
    "type": "notes",
    "notes": "C5 E5 G5",
    "velocity": 100,
    "duration": 150
  }
}
```

**Parameters:**
- `type`: Must be `"notes"` for note sequences
- `notes`: Space-separated note names (e.g., `"C4 E4 G4"`)
- `velocity`: MIDI velocity (0-127, default: 100)
- `duration`: Note duration in milliseconds (default: 100)

**Note Format:**
- Note names: `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B`
- Octave: `-1` to `9` (middle C is `C4`)
- Examples: `C4`, `F#5`, `Bb3`, `A4`

### 2. MIDI File (Future Feature)

> **Note:** MIDI file playback is planned for a future update. Currently, only note sequences are supported.

For future versions, you'll be able to load custom MIDI files:

```json
{
  "error": {
    "type": "midi",
    "file": "./chimes/error.mid"
  }
}
```

If you configure a MIDI file type, the application will fall back to playing a default note instead.

## Available Chime Types

- `success` - Plays when connection is established
- `connecting` - Plays when attempting to connect
- `warning` - Plays for warning messages
- `error` - Plays for error messages
- `info` - Plays for informational messages

## Examples

### Cheerful Success Chime
```json
{
  "success": {
    "type": "notes",
    "notes": "C5 E5 G5 C6",
    "velocity": 110,
    "duration": 120
  }
}
```

### Subtle Info Beep
```json
{
  "info": {
    "type": "notes",
    "notes": "A4",
    "velocity": 80,
    "duration": 100
  }
}
```

### Descending Error Alert
```json
{
  "error": {
    "type": "notes",
    "notes": "E5 C5 A4 F4",
    "velocity": 120,
    "duration": 200
  }
}
```

### Custom MIDI File
```json
{
  "success": {
    "type": "midi",
    "file": "./custom-chimes/success.mid",
    "comment": "MIDI file support coming in future update - currently uses fallback"
  }
}
```

## Future Features

### MIDI File Playback
MIDI file playback is planned for a future release. When implemented, you'll be able to:
1. Create custom MIDI files using your DAW
2. Save them in a `chimes/` directory
3. Reference them in `chimes.json`

Currently, configuring `"type": "midi"` will fall back to playing a default note.

## Fallback Behavior

If `chimes.json` fails to load, the application uses built-in default chimes:
- Success: C5 → E5
- Connecting: E4 → G4
- Warning: G4 → F4
- Error: F4 → D4
- Info: A4

## Tips

- **Volume Control**: Adjust `velocity` (lower = quieter, higher = louder)
- **Timing**: Adjust `duration` to make chimes shorter or longer
- **Spacing**: Notes are automatically spaced 50ms apart
- **Testing**: Change settings and reload the page to hear new chimes
- **MIDI Output**: Chimes only play when a MIDI output device is connected

## Troubleshooting

**Chimes don't play:**
- Ensure a MIDI output device is selected
- Check browser console for loading errors
- Verify `chimes.json` is valid JSON
- Confirm note names are correctly formatted

**Wrong notes play:**
- Check octave numbers (middle C is C4, not C5)
- Verify note names match standard notation
- Ensure velocity and duration are reasonable values

**File not found:**
- Check file path is relative to the application root
- Verify MIDI files exist in specified location
- Check file permissions are readable
