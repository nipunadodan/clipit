<?php
require_once 'env.php';

// --- Boilerplate ---
function db(): mysqli {
    static $conn;
    if (!$conn) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB);
        if ($conn->connect_error) die(json_encode(['error' => $conn->connect_error]));
    }
    return $conn;
}

function query(string $sql, string $types = '', ...$params): mysqli_stmt {
    $stmt = db()->prepare($sql);
    if ($types) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    return $stmt;
}

function fetchLinks(string $table): array {
    return query("SELECT id, text, pinned, created_at FROM `$table` ORDER BY pinned DESC, created_at DESC")
        ->get_result()
        ->fetch_all(MYSQLI_ASSOC);
}

// --- Rate Limiting (file-based, no DB) ---
define('RATE_LIMITS', [
    'GET'   => ['limit' => 60, 'window' => 60],
    'POST'  => ['limit' => 10, 'window' => 60],
    'PATCH' => ['limit' => 30, 'window' => 60],
]);

function enforceRateLimit(string $method): void {
    $ip  = preg_replace('/[^a-fA-F0-9:\.\-]/', '_', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $cfg = RATE_LIMITS[$method] ?? ['limit' => 30, 'window' => 60];

    $tmpDir   = sys_get_temp_dir();
    $maxFiles = 5;

    // Collect all rate-limit files sorted by last-modified time (oldest first)
    $allFiles = glob($tmpDir . DIRECTORY_SEPARATOR . 'rl_*.json') ?: [];
    usort($allFiles, fn($a, $b) => filemtime($a) - filemtime($b));

    // Delete oldest files until we are under the cap (leave room for this IP's file)
    $currentFile = $tmpDir . DIRECTORY_SEPARATOR . 'rl_' . md5($ip) . '.json';
    $isNew       = !file_exists($currentFile);
    $existing    = array_filter($allFiles, fn($f) => $f !== $currentFile);

    if ($isNew && count($existing) >= $maxFiles) {
        $toDelete = array_slice(array_values($existing), 0, count($existing) - $maxFiles + 1);
        foreach ($toDelete as $old) @unlink($old);
    }

    $file = $currentFile;
    $fh   = fopen($file, 'c+');
    if (!$fh) return; // fail open — don't block if filesystem is unavailable

    flock($fh, LOCK_EX);

    $data = json_decode(fread($fh, 65536), true) ?? [];
    $now  = time();

    // Keep only timestamps within the current window
    $data[$method] = array_values(array_filter(
        $data[$method] ?? [],
        fn(int $t) => ($now - $t) < $cfg['window']
    ));

    if (count($data[$method]) >= $cfg['limit']) {
        flock($fh, LOCK_UN);
        fclose($fh);
        http_response_code(429);
        header('Retry-After: ' . $cfg['window']);
        die(json_encode(['error' => 'Too many requests. Please slow down.']));
    }

    // Record this hit and persist
    $data[$method][] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));

    flock($fh, LOCK_UN);
    fclose($fh);
}

header('Content-Type: application/json');

$table  = DB_PREFIX . 'items';
$method = $_SERVER['REQUEST_METHOD'];

// Apply rate limiting before any SQL read/write
enforceRateLimit($method);

// --- Ensure table exists ---
query("CREATE TABLE IF NOT EXISTS `$table` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `text`       VARCHAR(2048) NOT NULL,
    `pinned`     TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

// Migrate: add pinned column to existing tables that don't have it
$col = db()->query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$table' AND COLUMN_NAME = 'pinned'");
if ($col && $col->num_rows === 0) {
    db()->query("ALTER TABLE `$table` ADD COLUMN `pinned` TINYINT(1) NOT NULL DEFAULT 0");
}

// --- GET: return stored links ---
if ($method === 'GET') {
    echo json_encode(fetchLinks($table));
    exit;
}

// --- POST: insert new URL, prune to last 5, return current list ---
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    // Login: verify submitted passkey hash from env.php
    if (array_key_exists('passkey', $body)) {
        $passkey = trim((string)$body['passkey']);
        if (!defined('PASSKEY') || PASSKEY === '') {
            http_response_code(500);
            die(json_encode(['error' => 'Passkey is not configured']));
        }
        if (!password_verify($passkey, PASSKEY)) {
            http_response_code(401);
            die(json_encode(['error' => 'Invalid passkey']));
        }

        echo json_encode(['authenticated' => true]);
        exit;
    }

    $text = $body['text'] ?? null;
    if (!$text) { http_response_code(400); die(json_encode(['error' => 'No text provided'])); }

    query("INSERT INTO `$table` (text, created_at) VALUES (?, NOW())", 's', $text);

    // Prune unpinned items only, keeping the latest 5
    query("DELETE FROM `$table` WHERE pinned = 0 AND id NOT IN (
        SELECT id FROM (
            SELECT id FROM `$table` WHERE pinned = 0 ORDER BY created_at DESC LIMIT 5
        ) AS keep
    )");

    echo json_encode(fetchLinks($table));
    exit;
}

// --- DELETE: delete single item by id, or truncate all ---
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);
    $id   = isset($body['id']) ? (int)$body['id'] : null;

    if ($id) {
        query("DELETE FROM `$table` WHERE id = ?", 'i', $id);
        echo json_encode(fetchLinks($table));
    } else {
        // Clear all unpinned items only
        query("DELETE FROM `$table` WHERE pinned = 0");
        echo json_encode(fetchLinks($table));
    }
    exit;
}

// --- PATCH: toggle pin state ---
if ($method === 'PATCH') {
    $body   = json_decode(file_get_contents('php://input'), true);
    $id     = isset($body['id'])     ? (int)$body['id']           : null;
    $pinned = isset($body['pinned']) ? (int)(bool)$body['pinned'] : null;

    if (!$id || $pinned === null) {
        http_response_code(400);
        die(json_encode(['error' => 'Invalid request']));
    }

    query("UPDATE `$table` SET pinned = ? WHERE id = ?", 'ii', $pinned, $id);
    echo json_encode(fetchLinks($table));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
