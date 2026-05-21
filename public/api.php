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
    return query("SELECT id, url, created_at FROM `$table` ORDER BY created_at DESC")
        ->get_result()
        ->fetch_all(MYSQLI_ASSOC);
}

header('Content-Type: application/json');

$table  = DB_PREFIX . 'items';
$method = $_SERVER['REQUEST_METHOD'];

// --- Ensure table exists ---
query("CREATE TABLE IF NOT EXISTS `$table` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `url`        VARCHAR(2048) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

// --- GET: return stored links ---
if ($method === 'GET') {
    echo json_encode(fetchLinks($table));
    exit;
}

// --- POST: insert new URL, prune to last 5, return current list ---
if ($method === 'POST') {
    $url = json_decode(file_get_contents('php://input'), true)['url'] ?? null;
    if (!$url) { http_response_code(400); die(json_encode(['error' => 'No URL provided'])); }

    query("INSERT INTO `$table` (url, created_at) VALUES (?, NOW())", 's', $url);

    query("DELETE FROM `$table` WHERE id NOT IN (
        SELECT id FROM (
            SELECT id FROM `$table` ORDER BY created_at DESC LIMIT 5
        ) AS keep
    )");

    echo json_encode(fetchLinks($table));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
