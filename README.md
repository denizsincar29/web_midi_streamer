# Web MIDI Streamer

**Version 1.1.0** - Real-time MIDI streaming over WebRTC

A peer-to-peer MIDI streaming application that allows two users to stream MIDI data between their devices in real-time using WebRTC technology.

## ✨ Features

- 🎹 **Real-time MIDI streaming** - Low latency peer-to-peer MIDI data transfer
- 🔗 **Room-based connections** - Easy setup with shareable URLs
- 💬 **Built-in chat** - Text messaging over the same WebRTC connection
- 🌍 **Multi-language** - English and Russian interface
- 🎵 **SysEx support** - Professional keyboard features
- 🔧 **Debug tools** - Connection testing and message export
- 📱 **PWA ready** - Install as an app, works offline
- ♿ **Accessible** - Full keyboard navigation and screen reader support
- 🎛️ **MIDI Tools** - Nord Effects Controller (BETA) and Chord Display for pianists

## 🚀 Quick Start

### For Users

1. **Connect your MIDI keyboard** to your computer first
2. **Open the app** in your browser (Chrome, Edge, Opera, or Firefox)
3. **Select your MIDI devices** from the dropdowns
4. **Enter a room name** and click "Connect to Room"
5. **Share the URL** with your partner
6. **Start playing!** 🎶

### For Developers

```bash
# Clone the repository
git clone https://github.com/denizsincar29/web_midi_streamer.git
cd web_midi_streamer

# Run setup script
uv run scripts/setup.py

# Start development server
php -S localhost:8080

# Open http://localhost:8080
```

## 📋 Requirements

- Modern web browser with Web MIDI API support
- MIDI devices (keyboard, controller, etc.)
- PHP-enabled web server for signaling
- Internet connection

## 🛠️ Setup

### Automated Setup (Recommended)

```bash
uv run scripts/setup.py
```

This creates:
- `config.php` with TURN server settings
- `chimes.json` for MIDI notification sounds
- `signaling_data/` directory for signaling

### Manual Setup

```bash
cp config.example.php config.php
cp chimes.example.json chimes.json
mkdir -p signaling_data
# Edit config.php with your settings
```

## 📖 Documentation

- **[Help Guide](help-en.html)** - Step-by-step usage instructions (includes version history)
- **[Russian Guide](help-ru.html)** - Русская справка (включает историю версий)
- **[Tools Help](tools/help.html)** - Documentation for MIDI Tools (Nord Effects & Chord Display)
- **[TURN Setup](TURN_SETUP.md)** - Configure TURN servers for better connectivity

## 🎛️ MIDI Tools

Web MIDI Streamer now includes professional tools for pianists and keyboard players:

### 🎚️ Nord Effects Controller (BETA)
Control Nord keyboard effects via MIDI CC messages. Adjust reverb, delay, rotary speaker, and more in real-time.

**⚠️ EXPERIMENTAL**: This tool is in beta and may be unstable. CC mappings may not work with all Nord keyboard models. Test carefully before using in performance settings.

### 🎼 Chord Display
Real-time jazz chord detection from MIDI input. See what chord you're playing with proper jazz notation, supporting 70+ chord types including extended and altered voicings.

Access tools via the "🎹 Tools" button in the main app header.

## 🏗️ Architecture

```
┌─────────┐     WebRTC P2P      ┌─────────┐
│ User 1  │◄──────────────────►│ User 2  │
└─────────┘                     └─────────┘
     │                               │
     └───── signaling.php ───────────┘
           (HTTP polling)
```

- **Frontend**: ES6 modules, Web MIDI API, WebRTC
- **Signaling**: PHP with HTTP polling
- **Data transfer**: Direct P2P via WebRTC data channels
- **Fallback**: TURN relay for restricted networks

## 🔧 Key Files

- `index.html` - Main application page
- `src/main.js` - Application orchestration
- `src/webrtc.js` - WebRTC connection management
- `src/midi.js` - MIDI device handling
- `src/ui.js` - User interface updates
- `src/i18n.js` - Internationalization translations
- `signaling.php` - WebRTC signaling server
- `service-worker.js` - PWA offline support
- `tools/` - MIDI tools (Nord Effects Controller, Chord Display)

## 🌐 Deployment

Deploy to any PHP-enabled hosting:
- Shared hosting (cPanel, etc.)
- VPS or cloud servers
- Platform-as-a-Service providers

The app uses free public STUN servers by default. For production, consider setting up your own TURN server (see [TURN_SETUP.md](TURN_SETUP.md)).

## 🐛 Troubleshooting

### Connection Issues

- **Takes long to connect**: WebRTC negotiation can take 5-10 seconds
- **Cannot connect**: Check that both users have internet access and use the same room URL
- **"No ICE candidates" error**: Verify signaling server is running and accessible

### MIDI Issues

- **MIDI access denied**: Connect MIDI devices before opening the website
- **No audio**: Check MIDI output device selection
- **Devices not appearing**: Click "Refresh Devices" or reconnect your MIDI device

### Cache Issues

The app uses service workers for offline support. If you see an old version:
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear browser cache and reload

## 📝 Version 1.0 Highlights

This release marks the first stable version with:
- ✅ Production-ready WebRTC implementation
- ✅ Real-time chat functionality
- ✅ Message export for debugging
- ✅ Improved caching strategy
- ✅ Comprehensive documentation
- ✅ Multi-language support

See [CHANGELOG.md](CHANGELOG.md) for complete release notes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is open source and available under the MIT License.

## 🔗 Links

- **GitHub**: https://github.com/denizsincar29/web_midi_streamer
- **Issues**: https://github.com/denizsincar29/web_midi_streamer/issues

---

Made with ❤️ for musicians and MIDI enthusiasts
