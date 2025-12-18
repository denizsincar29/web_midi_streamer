// TURN server configuration
// Fetches time-limited credentials from backend for security

// Cached credentials to avoid unnecessary server requests
let cachedCredentials = null;
let credentialExpiry = 0;

// Configuration constants
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const CREDENTIAL_EXPIRY_SAFETY_MARGIN_MS = 60000; // Expire 1 minute early for safety

/**
 * Default ICE servers configuration (used as a fallback).
 * Includes public STUN servers and a free TURN server.
 * @type {RTCIceServer[]}
 */
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

/**
 * Fetches time-limited TURN credentials from the backend.
 * Caches credentials to avoid unnecessary requests.
 * @param {function(string, string): void} [onStatusUpdate] - Optional callback for status updates.
 * @returns {Promise<RTCIceServer[]>} A promise that resolves to an array of ICE servers.
 */
export async function getTurnCredentials(onStatusUpdate) {
    const now = Date.now();
    if (cachedCredentials && now < credentialExpiry) {
        console.log(`Using cached TURN credentials (valid for ${Math.floor((credentialExpiry - now) / 1000)}s)`);
        return cachedCredentials;
    }

    try {
        const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const credentialsUrl = `${baseUrl}get-turn-credentials.php`;
        
        console.log('Fetching fresh TURN credentials from:', credentialsUrl);
        if (onStatusUpdate) {
            onStatusUpdate('🔑 Fetching TURN credentials...', 'info');
        }

        const response = await fetch(credentialsUrl);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('TURN credentials fetch failed:', {
                status: response.status,
                statusText: response.statusText,
                url: credentialsUrl,
                response: errorText.substring(0, 500)
            });
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.iceServers) {
            throw new Error('Invalid JSON response from credentials server');
        }

        console.log(`Successfully fetched TURN credentials (TTL: ${data.ttl}s)`);
        
        // Cache credentials, expiring 1 minute before actual expiry for safety
        cachedCredentials = data.iceServers;
        credentialExpiry = now + ((data.ttl || DEFAULT_TTL_SECONDS) * 1000) - CREDENTIAL_EXPIRY_SAFETY_MARGIN_MS;
        
        return cachedCredentials;
    } catch (error) {
        console.warn('Failed to fetch dynamic TURN credentials, using fallback:', error);
        if (onStatusUpdate) {
            onStatusUpdate('⚠️ Using fallback TURN servers. Connection may be less reliable.', 'warning');
        }
        return DEFAULT_ICE_SERVERS;
    }
}

// Check URL parameter to force TURN relay for testing
// Usage: ?forceTurn=true to disable direct P2P and test TURN server
function getIceTransportPolicy() {
    const params = new URLSearchParams(window.location.search);
    const forceTurn = params.get('forceTurn') === 'true';
    if (forceTurn) {
        console.warn('⚠️ TURN RELAY MODE: Forcing all connections through TURN server (no direct P2P)');
    }
    return forceTurn ? 'relay' : 'all';
}

export const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: getIceTransportPolicy()
    }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
