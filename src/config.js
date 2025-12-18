// TURN server configuration
// Fetches time-limited credentials from backend for security

// Cached credentials to avoid unnecessary server requests
let cachedCredentials = null;
let credentialExpiry = 0;

// Configuration constants
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const CREDENTIAL_EXPIRY_SAFETY_MARGIN_MS = 60000; // Expire 1 minute early for safety

// Default configuration (used as fallback if credential fetch fails)
const DEFAULT_ICE_SERVERS = [
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

// Fetch time-limited TURN credentials from backend
export async function getTurnCredentials() {
    // Check if we have valid cached credentials
    const now = Date.now();
    if (cachedCredentials && now < credentialExpiry) {
        console.log('Using cached TURN credentials (valid for', Math.floor((credentialExpiry - now) / 1000), 'seconds)');
        return cachedCredentials;
    }
    
    try {
        // Use relative path so it works in subdirectories (e.g., /midi/)
        const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const credentialsUrl = `${baseUrl}get-turn-credentials.php`;
        
        console.log('Fetching fresh TURN credentials from:', credentialsUrl);
        const response = await fetch(credentialsUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('TURN credentials fetch failed:', {
                status: response.status,
                statusText: response.statusText,
                url: credentialsUrl,
                response: errorText
            });
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Successfully fetched TURN credentials (TTL:', data.ttl, 'seconds)');
        
        // Cache credentials, expiring 1 minute before actual expiry for safety
        cachedCredentials = data.iceServers;
        credentialExpiry = now + ((data.ttl || DEFAULT_TTL_SECONDS) * 1000) - CREDENTIAL_EXPIRY_SAFETY_MARGIN_MS;
        
        return cachedCredentials;
    } catch (error) {
        console.warn('Failed to fetch dynamic TURN credentials, using fallback:', error);
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
