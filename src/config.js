// TURN server configuration
// Primary: Private TURN server (voice.denizsincar.ru)
// Fallback: Free public TURN servers (openrelay.metered.ca)

export const PEERJS_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            // STUN servers for NAT traversal
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            
            // Primary TURN server (voice.denizsincar.ru)
            {
                urls: 'turn:voice.denizsincar.ru:3478',
                username: 'webmidi',
                credential: 'iamsoprowdofmyinnovativemidistreamer'
            },
            {
                urls: 'turn:voice.denizsincar.ru:5349?transport=tcp',
                username: 'webmidi',
                credential: 'iamsoprowdofmyinnovativemidistreamer'
            },
            
            // Fallback TURN servers (openrelay.metered.ca)
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
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all'
    }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
