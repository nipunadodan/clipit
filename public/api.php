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

header('Content-Type: application/json');

$table  = DB_PREFIX . 'links';
$method = $_SERVER['REQUEST_METHOD'];

// --- GET: return stored links ---
if ($method === 'GET') {
    $result = query("SELECT id, url, created_at FROM `$table` ORDER BY created_at DESC")->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    exit;
}

// --- POST: insert new URL, prune to last 5, return current list ---
if ($method === 'POST') {
    $url = json_decode(file_get_contents('php://input'), true)['url'] ?? null;
    if (!$url) { http_response_code(400); die(json_encode(['error' => 'No URL provided'])); }

    // Insert new row
    query("INSERT INTO `$table` (url, created_at) VALUES (?, NOW())", 's', $url);

    // Delete rows beyond the last 5 (oldest first)
    query("DELETE FROM `$table` WHERE id NOT IN (
        SELECT id FROM (
            SELECT id FROM `$table` ORDER BY created_at DESC LIMIT 5
        ) AS keep
    )");

    $result = query("SELECT id, url, created_at FROM `$table` ORDER BY created_at DESC")->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
