# PWA Icons

✅ **Icons have been generated!**

This directory contains the PWA icon files:

- ✅ `icon-192x192.png` - 192x192 pixels (879 bytes)
- ✅ `icon-512x512.png` - 512x512 pixels (2.5 KB)
- ✅ `icon.svg` - SVG source template

## Design

The icons feature:
- **Purple gradient background** matching the app's color scheme (#667eea to #764ba2)
- **Piano keys** - 5 white keys with 3 black keys representing MIDI keyboard
- **Connection symbol** - Two nodes connected with a curved line representing WebRTC connection

## Regenerating Icons

If you need to regenerate the icons, run:

```bash
python3 generate_icons.py
```

The script requires Pillow (PIL):
```bash
pip3 install Pillow
```

## Files

- `icon-192x192.png` - Used for PWA install and Android home screen
- `icon-512x512.png` - Used for PWA splash screen and high-resolution displays  
- `icon.svg` - Vector source (can be edited in Inkscape or similar)
- `favicon.ico` - Browser tab icon (generated from 192x192)

## Icon Preview

The icons show piano keys (representing MIDI) with a connection symbol above (representing WebRTC streaming), all on the app's signature purple gradient background.

