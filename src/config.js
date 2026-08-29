// config.js — shared constants
//
// APP_VERSION must stay in sync with CACHE_NAME in service-worker.js.
// Bump them together with:  python3 scripts/bump.py [X.Y.Z]

// Used in the hello handshake so peers can detect stale clients.
export const APP_VERSION = 'jamrtc-v2.0.23';

// Version of the compact binary MIDI frame on the DataChannel.
// Bump only when the framing layout changes — see webrtc.js _handleBinaryPacket.
export const MIDI_FRAME_VERSION = 2;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
