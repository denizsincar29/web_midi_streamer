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
    // STUN servers for NAT traversal
    {
        urls: 'stun:stun.l.google.com:19302'
    },
    {
        urls: 'stun:stun1.l.google.com:19302'
    },
    {
        urls: 'stun:stun2.l.google.com:19302'
    },
    {
        urls: 'stun:stun3.l.google.com:19302'
    },
    {
        urls: 'stun:stun4.l.google.com:19302'
    },
    // Multiple fallback TURN servers for better reliability
    // Using multiple servers and transports for better connectivity
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    // Backup TURN servers using different providers
    {
        urls: [
            'turn:relay1.expressturn.com:3478',
            'turns:relay1.expressturn.com:5349'
        ],
        username: 'efKFD8V5M6C8U68GAM',
        credential: 'kSl2BLRM8bNU4Z3i'
    },
    {
        urls: [
            'turn:a.relay.metered.ca:80',
            'turn:a.relay.metered.ca:80?transport=tcp',
            'turn:a.relay.metered.ca:443',
            'turns:a.relay.metered.ca:443'
        ],
        username: '53a57e943919d1679fa6b866',
        credential: 'L1C/CTTQuRjNnx9u'
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

export const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
