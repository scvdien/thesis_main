<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode((string) $input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload.']);
    exit;
}

$username = (string) ($data['username'] ?? '');
$reauthToken = (string) ($data['reauth_token'] ?? '');

$result = auth_verify_offline_reauth_token($username, $reauthToken);

if (!$result['success']) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => $result['error']]);
    exit;
}

$csrfToken = auth_csrf_token();

echo json_encode([
    'success' => true,
    'csrf_token' => $csrfToken,
    'user' => [
        'id' => $result['user']['id'],
        'username' => $result['user']['username'],
        'role' => $result['user']['role'],
        'full_name' => $result['user']['full_name'],
    ],
]);
