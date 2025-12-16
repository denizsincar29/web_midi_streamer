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
        const response = await fetch('/get-turn-credentials.php');
        if (!response.ok) {
            throw new Error('Failed to fetch TURN credentials');
        }
        const data = await response.json();
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
