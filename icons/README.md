# PWA Icons

This directory should contain the following icon files for the Progressive Web App:

- `icon-192x192.png` - 192x192 pixels icon
- `icon-512x512.png` - 512x512 pixels icon

## Creating Icons

You can create these icons using any image editor. The icons should:
- Have a transparent or solid background
- Feature a recognizable MIDI/music symbol (e.g., piano keys, musical note, or MIDI connector)
- Use the app's color scheme (purple gradient: #667eea to #764ba2)

### Quick Icon Generation

Use an online tool like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

Or create with ImageMagick:
```bash
# Create a simple colored icon with text
convert -size 512x512 xc:"#667eea" -gravity center -pointsize 200 -fill white -annotate +0+0 "🎹" icon-512x512.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
```

For now, temporary placeholder icons will be generated automatically.
