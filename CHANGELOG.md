# Changelog

All notable changes to Web MIDI Streamer will be documented in this file.

## [1.0.0] - 2025-12-21

### 🎉 First Stable Release

This marks the first stable release of Web MIDI Streamer, a real-time WebRTC-based MIDI streaming application.

### ✨ Features

- **Real-time MIDI Streaming**: Stream MIDI data between two users over WebRTC with low latency
- **WebRTC P2P Connection**: Direct peer-to-peer connection with automatic TURN relay fallback
- **Room-based System**: Easy connection using shareable URLs with room names
- **Multi-language Support**: English and Russian interface translations
- **MIDI Device Management**: Support for multiple MIDI input and output devices
- **SysEx Support**: Optional System Exclusive messages for advanced keyboard features
- **Timestamp Synchronization**: Experimental feature for improved timing on slow connections
- **IPv6 Support**: Automatic IPv4/IPv6 dual-stack connectivity
- **Chat System**: Real-time text chat over the same WebRTC connection
- **Debug Tools**: Built-in testing tools including ping, test notes, and MIDI echo
- **Message Export**: Copy all debug messages for troubleshooting
- **PWA Support**: Progressive Web App with offline capability and installability
- **Accessibility**: Full keyboard navigation and screen reader support

### 🛠️ Technical Improvements

- Custom HTTP polling-based signaling server (PHP)
- Modular ES6 architecture with clear separation of concerns
- Service worker caching for offline functionality
- Comprehensive error handling and user feedback
- MIDI chimes for connection events

### 🐛 Bug Fixes

- Fixed cache issues causing old page versions to load
- Improved ICE candidate handling and connection stability
- Better error messages for connection failures

### 📚 Documentation

- Comprehensive README with setup instructions
- Multilingual help pages (English and Russian)
- TURN server setup guide
- Development history and changelog

---

## Development History

### Early Development (2024)

**Initial Concept**: The project started as a way to enable remote MIDI collaboration over the internet using WebRTC technology.

**Core Features**:
- Basic WebRTC peer-to-peer MIDI streaming
- Simple room-based connection system
- MIDI device selection interface

### Evolution

**WebRTC Improvements**:
- Migrated from library-based to native WebRTC implementation
- Added custom PHP signaling server with HTTP polling
- Implemented ICE candidate queuing and connection monitoring
- Added TURN server support for global connectivity

**User Experience**:
- Developed comprehensive help system
- Added multilingual support (English and Russian)
- Implemented PWA features for app-like experience
- Added accessibility features for screen readers

**Features Expansion**:
- SysEx message support for professional keyboards
- Experimental timestamp synchronization
- Debug tools for connection testing
- MIDI chimes for audio feedback
- IPv6 connectivity support

**Recent Improvements** (v1.0):
- Added real-time chat functionality
- Improved service worker caching strategy
- Added message export feature for debugging
- Updated documentation and help files
- Created comprehensive changelog

### Contributors

Special thanks to all contributors who helped build and improve Web MIDI Streamer, including:
- Deniz Sincar - Original author and maintainer
- Community contributors and testers

---

For the latest updates and to report issues, visit:
https://github.com/denizsincar29/web_midi_streamer
