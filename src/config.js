// TURN server configuration
// Fetches time-limited credentials from backend for security

// Default configuration (used as fallback if credential fetch fails)
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];

// Fetch time-limited TURN credentials from backend
export async function getTurnCredentials() {
    try {
        // Use relative path so it works in subdirectories (e.g., /midi/)
        const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const credentialsUrl = `${baseUrl}get-turn-credentials.php`;
        
        console.log('Fetching TURN credentials from:', credentialsUrl);
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
        console.log('Successfully fetched TURN credentials');
        return data.iceServers;
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
        iceTransportPolicy: 'all'
    }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
