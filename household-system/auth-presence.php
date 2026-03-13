<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed.',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

auth_bootstrap_store();
auth_require_api([], true);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => true,
    'status' => 'online',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
