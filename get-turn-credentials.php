<?php
/**
 * TURN Credential Generator
 * 
 * Generates time-limited TURN credentials using HMAC-SHA1
 * Based on the TURN REST API specification
 * 
 * IMPORTANT SECURITY NOTES:
 * 1. Replace YOUR_STATIC_AUTH_SECRET_HERE with your actual secret from turnserver.conf
 * 2. Restrict CORS to your actual domain (replace * with your domain)
 * 3. Consider using environment variables in production
 */

header('Content-Type: application/json');

// SECURITY: Replace * with your actual domain (e.g., 'https://yourdomain.com')
// For development on localhost, you can use: 'http://localhost' or keep '*'
$allowedOrigin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
if (strpos($allowedOrigin, 'localhost') !== false || strpos($allowedOrigin, '127.0.0.1') !== false) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
} else {
    // In production, replace with your actual domain
    header('Access-Control-Allow-Origin: *'); // TODO: Change to your domain
}

// Configuration
$turnServer = 'voice.denizsincar.ru';

// SECURITY: Replace with your actual static-auth-secret from /etc/turnserver.conf
// Or use environment variable: $turnSecret = getenv('TURN_SECRET');
$turnSecret = 'YOUR_STATIC_AUTH_SECRET_HERE'; // TODO: Replace this!

if ($turnSecret === 'YOUR_STATIC_AUTH_SECRET_HERE') {
    http_response_code(500);
    die(json_encode([
        'error' => 'TURN secret not configured. Please update get-turn-credentials.php'
    ]));
}

$ttl = 3600; // Credentials valid for 1 hour

// Generate time-limited credentials
$timestamp = time() + $ttl;
$username = $timestamp . ':webmidi';
$password = base64_encode(hash_hmac('sha1', $username, $turnSecret, true));

// Return TURN credentials
echo json_encode([
    'iceServers' => [
        // STUN servers
        [
            'urls' => 'stun:stun.l.google.com:19302'
        ],
        [
            'urls' => 'stun:stun1.l.google.com:19302'
        ],
        // TURN servers with time-limited credentials
        [
            'urls' => 'turn:' . $turnServer . ':3478',
            'username' => $username,
            'credential' => $password
        ],
        [
            'urls' => 'turn:' . $turnServer . ':5349?transport=tcp',
            'username' => $username,
            'credential' => $password
        ],
        // Fallback public TURN servers
        [
            'urls' => 'turn:openrelay.metered.ca:80',
            'username' => 'openrelayproject',
            'credential' => 'openrelayproject'
        ],
        [
            'urls' => 'turn:openrelay.metered.ca:443',
            'username' => 'openrelayproject',
            'credential' => 'openrelayproject'
        ]
    ],
    'ttl' => $ttl,
    'generated' => date('Y-m-d H:i:s')
]);
