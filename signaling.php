<?php
/**
 * Simple HTTP-based WebRTC Signaling Server
 * 
 * Handles exchange of SDP offers/answers and ICE candidates between peers
 * Uses file-based storage for simplicity (replace with Redis/DB for production)
 */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// CORS headers
$allowedOrigins = ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array('*', $allowedOrigins)) {
    header('Access-Control-Allow-Origin: *');
} elseif (!empty($origin) && in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuration
$dataDir = __DIR__ . '/signaling_data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Clean up old sessions (older than 1 hour)
$cleanupTime = time() - 3600;
foreach (glob($dataDir . '/*.json') as $file) {
    if (filemtime($file) < $cleanupTime) {
        unlink($file);
    }
}

$action = $_GET['action'] ?? '';
$roomId = $_GET['room'] ?? '';
$peerId = $_GET['peer'] ?? '';

// Validate room ID
if (empty($roomId) || !preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $roomId)) {
    http_response_code(400);
    die(json_encode(['error' => 'Invalid room ID']));
}

$roomFile = $dataDir . '/' . $roomId . '.json';

function readRoom($file) {
    if (!file_exists($file)) {
        return ['peers' => [], 'messages' => []];
    }
    $data = json_decode(file_get_contents($file), true);
    return $data ?: ['peers' => [], 'messages' => []];
}

function writeRoom($file, $data) {
    file_put_contents($file, json_encode($data));
}

switch ($action) {
    case 'join':
        // Peer joins room
        if (empty($peerId) || !preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $peerId)) {
            http_response_code(400);
            die(json_encode(['error' => 'Invalid peer ID']));
        }
        
        $room = readRoom($roomFile);
        
        // Add peer if not already in room
        if (!in_array($peerId, $room['peers'])) {
            $room['peers'][] = $peerId;
            writeRoom($roomFile, $room);
        }
        
        // Return list of other peers in room
        $otherPeers = array_filter($room['peers'], fn($p) => $p !== $peerId);
        echo json_encode([
            'success' => true,
            'peers' => array_values($otherPeers)
        ]);
        break;
        
    case 'send':
        // Send message (offer/answer/ice candidate) to room
        if (empty($peerId)) {
            http_response_code(400);
            die(json_encode(['error' => 'Missing peer ID']));
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['type']) || !isset($input['data'])) {
            http_response_code(400);
            die(json_encode(['error' => 'Invalid message format']));
        }
        
        $room = readRoom($roomFile);
        
        // Add message to queue
        $message = [
            'from' => $peerId,
            'to' => $input['to'] ?? null,
            'type' => $input['type'],
            'data' => $input['data'],
            'timestamp' => time()
        ];
        
        $room['messages'][] = $message;
        
        // Keep only last 100 messages
        if (count($room['messages']) > 100) {
            $room['messages'] = array_slice($room['messages'], -100);
        }
        
        writeRoom($roomFile, $room);
        
        echo json_encode(['success' => true]);
        break;
        
    case 'poll':
        // Poll for new messages
        if (empty($peerId)) {
            http_response_code(400);
            die(json_encode(['error' => 'Missing peer ID']));
        }
        
        $since = intval($_GET['since'] ?? 0);
        $room = readRoom($roomFile);
        
        // Get messages for this peer since timestamp
        $newMessages = array_filter($room['messages'], function($msg) use ($peerId, $since) {
            return $msg['timestamp'] > $since && 
                   ($msg['to'] === $peerId || $msg['to'] === null);
        });
        
        echo json_encode([
            'success' => true,
            'messages' => array_values($newMessages),
            'timestamp' => time()
        ]);
        break;
        
    case 'leave':
        // Peer leaves room
        if (empty($peerId)) {
            http_response_code(400);
            die(json_encode(['error' => 'Missing peer ID']));
        }
        
        $room = readRoom($roomFile);
        $room['peers'] = array_filter($room['peers'], fn($p) => $p !== $peerId);
        
        // Delete room file if empty
        if (empty($room['peers'])) {
            if (file_exists($roomFile)) {
                unlink($roomFile);
            }
        } else {
            writeRoom($roomFile, $room);
        }
        
        echo json_encode(['success' => true]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}
