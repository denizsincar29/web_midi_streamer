<?php
/**
 * TURN Credential Generator
 * 
 * Generates time-limited TURN credentials using HMAC-SHA1
 * Based on the TURN REST API specification
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Configuration
$turnServer = 'voice.denizsincar.ru';
$turnSecret = 'YOUR_STATIC_AUTH_SECRET_HERE'; // Replace with your actual static-auth-secret from turnserver.conf
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
