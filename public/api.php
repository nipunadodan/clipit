<?php
require_once 'env.php';

// --- Token Management ---
define('TOKEN_FILE', sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clipit_tokens.json');
define('TOKEN_EXPIRY_SEC', 7 * 24 * 3600);

function loadTokens(): array {
    if (!file_exists(TOKEN_FILE)) return [];
    $fh = fopen(TOKEN_FILE, 'r');
    if (!$fh) return [];
    flock($fh, LOCK_SH);
    $raw = fread($fh, 1048576);
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = json_decode($raw, true) ?? [];
    $now  = time();
    return array_filter($data, fn($expiry) => $expiry > $now);
}

function saveTokens(array $tokens): void {
    $fh = fopen(TOKEN_FILE, 'c');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($tokens));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function generateToken(): string {
    $token  = bin2hex(random_bytes(32));
    $tokens = loadTokens();
    $tokens[hash('sha256', $token)] = time() + TOKEN_EXPIRY_SEC;
    saveTokens($tokens);
    return $token;
}

function validateToken(): bool {
    $token = $_COOKIE['clipit_token'] ?? '';
    if (!$token) return false;
    $tokens = loadTokens();
    return isset($tokens[hash('sha256', $token)]);
}

function setTokenCookie(string $token): void {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie('clipit_token', $token, [
        'expires'  => time() + TOKEN_EXPIRY_SEC,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function revokeToken(): void {
    $token = $_COOKIE['clipit_token'] ?? '';
    if ($token) {
        $tokens = loadTokens();
        unset($tokens[hash('sha256', $token)]);
        saveTokens($tokens);
    }
    setcookie('clipit_token', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

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
    return query("SELECT id, text, pinned, image IS NOT NULL AS image, created_at FROM `$table` ORDER BY pinned DESC, created_at DESC")
        ->get_result()
        ->fetch_all(MYSQLI_ASSOC);
}

function imageMime(string $image): ?string {
    $info = @getimagesizefromstring($image);
    $mime = $info['mime'] ?? null;
    return in_array($mime, ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], true) ? $mime : null;
}

function readUploadedImage(): ?string {
    if (!isset($_FILES['image'])) return null;

    $file = $_FILES['image'];
    $error = $file['error'] ?? null;
    if ($error !== UPLOAD_ERR_OK) {
        http_response_code(in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 400);
        die(json_encode(['error' => 'Image upload failed. Check the file size and PHP upload limits.']));
    }
    if (!is_string($file['tmp_name'] ?? null) || !is_int($file['size'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        die(json_encode(['error' => 'Invalid image upload']));
    }
    if ($file['size'] > 16777215) {
        http_response_code(413);
        die(json_encode(['error' => 'Image exceeds the MEDIUMBLOB limit (16 MiB minus 1 byte)']));
    }

    $image = file_get_contents($file['tmp_name']);
    if ($image === false) {
        http_response_code(500);
        die(json_encode(['error' => 'Could not read uploaded image']));
    }
    if (imageMime($image) === null) {
        http_response_code(400);
        die(json_encode(['error' => 'Upload a PNG, JPEG, GIF or WebP image']));
    }
    return $image;
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

// --- Auth gate: validate token for all requests except passkey login/logout ---
// Peek at body for POST to allow passkey and logout through without a token
$_rawBody = null;
$_parsedBody = null;
function getRawBody(): string {
    global $_rawBody;
    if ($_rawBody === null) $_rawBody = file_get_contents('php://input');
    return $_rawBody;
}
function getParsedBody(): array {
    global $_parsedBody;
    if ($_parsedBody === null) {
        $_parsedBody = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0
            ? $_POST
            : (json_decode(getRawBody(), true) ?? []);
    }
    return $_parsedBody;
}

$isPasskeyLogin  = ($method === 'POST' && array_key_exists('passkey', getParsedBody()));
$isLogout        = ($method === 'POST' && isset(getParsedBody()['logout']));

if (!$isPasskeyLogin && !$isLogout && !validateToken()) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}

// --- Ensure table exists ---
query("CREATE TABLE IF NOT EXISTS `$table` (
    `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `text`       VARCHAR(2048) NOT NULL,
    `pinned`     TINYINT(1) NOT NULL DEFAULT 0,
    `image`      MEDIUMBLOB,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

// Migrate: add pinned column to existing tables that don't have it
$col = db()->query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$table' AND COLUMN_NAME = 'pinned'");
if ($col && $col->num_rows === 0) {
    db()->query("ALTER TABLE `$table` ADD COLUMN `pinned` TINYINT(1) NOT NULL DEFAULT 0");
}

$col = query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'image'", 's', $table)
    ->get_result();
if ($col->num_rows === 0) {
    query("ALTER TABLE `$table` ADD COLUMN `image` MEDIUMBLOB");
}

// --- GET: return stored links ---
if ($method === 'GET') {
    if (isset($_GET['image'])) {
        $id = filter_var($_GET['image'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            http_response_code(400);
            die(json_encode(['error' => 'Invalid image ID']));
        }
        $entry = query("SELECT image FROM `$table` WHERE id = ?", 'i', $id)
            ->get_result()->fetch_assoc();
        if (!$entry || $entry['image'] === null) {
            http_response_code(404);
            die(json_encode(['error' => 'Image not found']));
        }
        $mime = imageMime($entry['image']);
        if ($mime === null) {
            http_response_code(500);
            die(json_encode(['error' => 'Stored image is invalid']));
        }
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . strlen($entry['image']));
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        echo $entry['image'];
        exit;
    }
    echo json_encode(fetchLinks($table));
    exit;
}

// --- POST: insert new URL, prune to last 5, return current list ---
if ($method === 'POST') {
    $body = getParsedBody();

    // Logout
    if (isset($body['logout'])) {
        revokeToken();
        echo json_encode(['authenticated' => false]);
        exit;
    }

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

        $token = generateToken();
        setTokenCookie($token);
        echo json_encode(['authenticated' => true]);
        exit;
    }

    $text = $body['text'] ?? '';
    $image = readUploadedImage();
    if (!is_string($text) || (trim($text) === '' && $image === null)) {
        http_response_code(400);
        die(json_encode(['error' => 'Provide text or an image']));
    }

    if ($image !== null) {
        $lock = 'clipit:image:' . md5(DB . ':' . $table);
        $locked = query("SELECT GET_LOCK(?, 5) AS acquired", 's', $lock)->get_result()->fetch_assoc();
        if ((int)$locked['acquired'] !== 1) {
            http_response_code(503);
            die(json_encode(['error' => 'Another image is being saved. Please try again.']));
        }

        $saved = false;
        try {
            db()->begin_transaction();
            query("DELETE FROM `$table` WHERE image IS NOT NULL");
            query("INSERT INTO `$table` (text, image, created_at) VALUES (?, ?, NOW())", 'ss', $text, $image);
            db()->commit();
            $saved = true;
        } catch (mysqli_sql_exception $e) {
            db()->rollback();
            error_log('Image replacement failed: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Could not save image']);
        } finally {
            query("SELECT RELEASE_LOCK(?)", 's', $lock);
        }
        if (!$saved) exit;
    } else {
        query("INSERT INTO `$table` (text, image, created_at) VALUES (?, ?, NOW())", 'ss', $text, $image);
    }

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
    $body = getParsedBody();
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

// --- PATCH: edit text or toggle pin state ---
if ($method === 'PATCH') {
    $body = getParsedBody();
    $id   = isset($body['id']) ? (int)$body['id'] : null;

    if (!$id) {
        http_response_code(400);
        die(json_encode(['error' => 'Invalid request']));
    }

    // Edit entry text
    if (array_key_exists('text', $body)) {
        $text = trim((string)$body['text']);
        if ($text === '') {
            http_response_code(400);
            die(json_encode(['error' => 'No text provided']));
        }
        query("UPDATE `$table` SET text = ? WHERE id = ?", 'si', $text, $id);
        echo json_encode(fetchLinks($table));
        exit;
    }

    // Toggle pin state
    $pinned = isset($body['pinned']) ? (int)(bool)$body['pinned'] : null;
    if ($pinned === null) {
        http_response_code(400);
        die(json_encode(['error' => 'Invalid request']));
    }

    query("UPDATE `$table` SET pinned = ? WHERE id = ?", 'ii', $pinned, $id);
    echo json_encode(fetchLinks($table));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
