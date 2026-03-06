<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$currentUser = auth_current_user();
if (is_array($currentUser)) {
    auth_audit_log([
        'user' => $currentUser,
        'action_key' => 'logout',
        'action_type' => 'access',
        'module_name' => 'Authentication',
        'record_type' => 'session',
        'record_id' => (string) ($currentUser['username'] ?? ''),
        'details' => 'User logged out.',
    ]);
}

auth_logout();
auth_redirect('login.php');
