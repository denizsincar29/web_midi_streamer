<?php
/**
 * TURN Credential Generator
 * 
 * Generates time-limited TURN credentials using HMAC-SHA1
 * Based on the TURN REST API specification
 */

// Configuration constants
define('RATE_LIMIT_WINDOW_SECONDS', 60);
define('MAX_REQUESTS_PER_MINUTE', 10);

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Content-Type: application/json');

// Simple rate limiting using session
session_start();
$now = time();
$sessionKey = 'credential_requests';

// Initialize or clean up old requests
if (!isset($_SESSION[$sessionKey])) {
    $_SESSION[$sessionKey] = [];
}

// Remove requests older than the rate limit window
$_SESSION[$sessionKey] = array_filter(
    $_SESSION[$sessionKey],
    function($timestamp) use ($now) {
        return $timestamp > ($now - RATE_LIMIT_WINDOW_SECONDS);
    }
);

// Check rate limit
if (count($_SESSION[$sessionKey]) >= MAX_REQUESTS_PER_MINUTE) {
    http_response_code(429);
    die(json_encode([
        'error' => 'Rate limit exceeded. Please try again later.',
        'retry_after' => RATE_LIMIT_WINDOW_SECONDS
    ]));
}

// Record this request
$_SESSION[$sessionKey][] = $now;

// Load configuration from config.php (not tracked in git)
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    die(json_encode([
        'error' => 'Configuration not found. Please copy config.example.php to config.php and update with your settings.'
    ]));
}

$config = require __DIR__ . '/config.php';

// CORS handling
$allowedOrigins = $config['allowedOrigins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array('*', $allowedOrigins)) {
    header('Access-Control-Allow-Origin: *');
} elseif (!empty($origin) && in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

// Validate configuration
$turnServer = $config['turnServer'] ?? '';
$turnSecret = $config['turnSecret'] ?? '';
$ttl = $config['ttl'] ?? 3600;

if (empty($turnSecret) || $turnSecret === 'YOUR_STATIC_AUTH_SECRET_HERE') {
    http_response_code(500);
    die(json_encode([
        'error' => 'TURN secret not configured. Please update config.php with your static-auth-secret'
    ]));
}

if (empty($turnServer)) {
    http_response_code(500);
    die(json_encode([
        'error' => 'TURN server not configured. Please update config.php'
    ]));
}

// Generate time-limited credentials
$timestamp = time() + $ttl;
$username = $timestamp . ':webmidi';
$password = base64_encode(hash_hmac('sha1', $username, $turnSecret, true));

// Return ICE servers (STUN + TURN)
echo json_encode([
    'iceServers' => [
        // STUN servers for NAT traversal
        [
            'urls' => 'stun:stun.l.google.com:19302'
        ],
        [
            'urls' => 'stun:stun1.l.google.com:19302'
        ],
        // TURN servers with time-limited credentials
        [
            'urls' => 'turn:' . $turnServer . ':3479',
            'username' => $username,
            'credential' => $password
        ],
        [
            'urls' => 'turn:' . $turnServer . ':5350?transport=tcp',
            'username' => $username,
            'credential' => $password
        ],
        // Fallback public TURN server
        [
            'urls' => 'turn:openrelay.metered.ca:80',
            'username' => 'openrelayproject',
            'credential' => 'openrelayproject'
        ]
    ],
    'ttl' => $ttl,
    'generated' => date('Y-m-d H:i:s')
]);
