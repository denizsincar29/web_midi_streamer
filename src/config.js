// config.js — kept for backward compatibility
// WebRTC signaling is now handled entirely in webrtc.js via WebSocket/MQTT.
// This file only exports NOTE_NAMES used by other modules.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Legacy exports (no longer used by webrtc.js but kept to avoid import errors)
export const SIGNALING_CONFIG = {
    pollingInterval: 2000,
    maxRetries: 3,
    retryDelay: 1000
};

export async function getTurnCredentials() {
    // TURN credentials are no longer fetched from PHP.
    // WebRTC now uses free public STUN servers by default.
    // To add TURN, edit DEFAULT_ICE_SERVERS in webrtc.js.
    return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
    ];
}
