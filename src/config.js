// Free public TURN servers (openrelay.metered.ca)
// Note: These are public credentials for a free service - safe to commit
const TURN_USERNAME = 'openrelayproject';
const TURN_CREDENTIAL = 'openrelayproject';

export const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: TURN_USERNAME,
                credential: TURN_CREDENTIAL
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: TURN_USERNAME,
                credential: TURN_CREDENTIAL
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: TURN_USERNAME,
                credential: TURN_CREDENTIAL
            }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all'
    }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
