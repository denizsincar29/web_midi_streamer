<?php
// Serves the latest built .nvda-addon file for download.
// URL: /nvda_addon/download.php
// Stable URL regardless of addon version — no cache-busting needed.

$dir   = __DIR__;
$files = glob($dir . '/*.nvda-addon');

if (empty($files)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo "NVDA addon not found. Run rebuild.sh on the server.";
    exit;
}

// Pick the newest file by mtime in case multiple exist during deploy
usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
$file = $files[0];
$name = basename($file);

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . filesize($file));
header('Cache-Control: no-store, must-revalidate');
header('Pragma: no-cache');

readfile($file);
