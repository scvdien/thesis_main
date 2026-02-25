<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/**
 * @param array<string, mixed> $payload
 */
function users_api_respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function users_api_error(int $statusCode, string $message): never
{
    users_api_respond($statusCode, [
        'success' => false,
        'error' => $message,
    ]);
}

function users_api_text(mixed $value, int $maxLength = 255): string
{
    $text = trim((string) $value);
    $text = preg_replace('/[\x00-\x1F\x7F]/', '', $text);
    if ($text === null) {
        $text = trim((string) $value);
    }
    if (strlen($text) > $maxLength) {
        $text = substr($text, 0, $maxLength);
    }
    return $text;
}

function users_api_normalized_username(mixed $value): string
{
    $username = users_api_text($value, 80);
    if ($username === '') {
        return '';
    }
    if (preg_match('/^[A-Za-z0-9._-]{3,80}$/', $username) !== 1) {
        return '';
    }
    return $username;
}

function users_api_password_min(string $password): bool
{
    return strlen($password) >= 8;
}

function users_api_password_strong(string $password): bool
{
    return strlen($password) >= 8 && preg_match('/[^A-Za-z0-9]/', $password) === 1;
}

/**
 * @return array<string, mixed>
 */
function users_api_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        users_api_error(400, 'Invalid JSON payload.');
    }
    return $decoded;
}

/**
 * @param array<string, mixed>|null $row
 * @return array<string, mixed>|null
 */
function users_api_build_user_payload(?array $row): ?array
{
    if (!is_array($row)) {
        return null;
    }

    $role = auth_normalize_role((string) ($row['role'] ?? ''));
    $isActive = (int) ($row['is_active'] ?? 0) === 1;
    $requiresCredentialUpdate = (int) ($row['must_change_password'] ?? 0) === 1;

    return [
        'id' => (int) ($row['id'] ?? 0),
        'fullName' => (string) ($row['full_name'] ?? ''),
        'username' => (string) ($row['username'] ?? ''),
        'role' => $role,
        'roleLabel' => auth_role_label($role),
        'contactNumber' => (string) ($row['contact_number'] ?? ''),
        'isActive' => $isActive,
        'status' => $isActive ? 'active' : 'deactivated',
        'requiresCredentialUpdate' => $requiresCredentialUpdate,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

/**
 * @return array<string, mixed>|null
 */
function users_api_find_by_role(PDO $pdo, string $role): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `full_name`, `username`, `role`, `contact_number`, `is_active`, `must_change_password`, `created_at`, `updated_at`
         FROM `users`
         WHERE `role` = :role
         ORDER BY `id` ASC
         LIMIT 1'
    );
    $stmt->execute(['role' => $role]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

/**
 * @return array<string, mixed>|null
 */
function users_api_find_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `full_name`, `username`, `password_hash`, `role`, `contact_number`, `is_active`, `must_change_password`, `created_at`, `updated_at`
         FROM `users`
         WHERE `id` = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $userId]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

/**
 * @return array<int, array<string, mixed>>
 */
function users_api_staff_accounts(PDO $pdo, bool $includePasswordPlain = false): array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `full_name`, `username`, `role`, `contact_number`, `password_plain`, `is_active`, `must_change_password`, `created_at`, `updated_at`
         FROM `users`
         WHERE `role` = :role
         ORDER BY `id` DESC'
    );
    $stmt->execute(['role' => AUTH_ROLE_STAFF]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $accounts = [];
    foreach ($rows as $row) {
        $payload = users_api_build_user_payload($row);
        if (!is_array($payload)) {
            continue;
        }
        $payload['role'] = AUTH_ROLE_STAFF;
        $payload['roleLabel'] = 'Registration Staff';
        $payload['module'] = 'Registration Module';
        if ($includePasswordPlain) {
            $payload['passwordVisible'] = (string) ($row['password_plain'] ?? '');
        }
        $accounts[] = $payload;
    }
    return $accounts;
}

function users_api_module_name(string $role): string
{
    return match (auth_normalize_role($role)) {
        AUTH_ROLE_CAPTAIN => 'Barangay Captain Dashboard',
        AUTH_ROLE_ADMIN => 'Admin Dashboard',
        AUTH_ROLE_STAFF => 'Registration Module',
        default => 'General Module',
    };
}

/**
 * @return array<int, array<string, mixed>>
 */
function users_api_active_accounts(PDO $pdo): array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `full_name`, `username`, `role`, `contact_number`, `is_active`, `must_change_password`, `created_at`, `updated_at`
         FROM `users`
         WHERE `is_active` = 1
         ORDER BY `role` ASC, `full_name` ASC, `id` ASC'
    );
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $accounts = [];
    foreach ($rows as $row) {
        $payload = users_api_build_user_payload($row);
        if (!is_array($payload)) {
            continue;
        }
        $role = auth_normalize_role((string) ($payload['role'] ?? ''));
        $payload['module'] = users_api_module_name($role);
        $accounts[] = $payload;
    }
    return $accounts;
}

/**
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function users_api_settings_payload(PDO $pdo, array $authUser): array
{
    $requesterRole = auth_user_role($authUser);
    $current = users_api_find_user($pdo, (int) ($authUser['id'] ?? 0));
    $currentPayload = users_api_build_user_payload($current);

    // Fallback to session snapshot when DB lookup fails unexpectedly.
    if (!is_array($currentPayload)) {
        $currentPayload = [
            'id' => (int) ($authUser['id'] ?? 0),
            'fullName' => (string) ($authUser['full_name'] ?? ''),
            'username' => (string) ($authUser['username'] ?? ''),
            'role' => auth_normalize_role((string) ($authUser['role'] ?? '')),
            'roleLabel' => auth_role_label((string) ($authUser['role'] ?? '')),
            'contactNumber' => '',
            'isActive' => true,
            'status' => 'active',
            'requiresCredentialUpdate' => (bool) ($authUser['requires_credential_update'] ?? false),
            'createdAt' => '',
            'updatedAt' => '',
        ];
    }

    return [
        'current_user' => $currentPayload,
        'admin_account' => users_api_build_user_payload(users_api_find_by_role($pdo, AUTH_ROLE_SECRETARY)),
        'staff_accounts' => users_api_staff_accounts($pdo, $requesterRole === AUTH_ROLE_ADMIN),
        'active_users' => users_api_active_accounts($pdo),
    ];
}

/**
 * @param array<string, mixed> $user
 */
function users_api_refresh_session_user(array $user): void
{
    auth_start_session();
    $_SESSION[AUTH_SESSION_USER_KEY] = [
        'id' => (int) ($user['id'] ?? 0),
        'full_name' => (string) ($user['full_name'] ?? ''),
        'username' => (string) ($user['username'] ?? ''),
        'role' => auth_normalize_role((string) ($user['role'] ?? '')),
        'requires_credential_update' => (int) ($user['must_change_password'] ?? 0) === 1,
    ];
    $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY] = time();
}

function users_api_username_exists(PDO $pdo, string $username, int $exceptUserId = 0): bool
{
    $sql = 'SELECT 1 FROM `users` WHERE `username` = :username';
    $params = ['username' => $username];
    if ($exceptUserId > 0) {
        $sql .= ' AND `id` <> :except_id';
        $params['except_id'] = $exceptUserId;
    }
    $sql .= ' LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (bool) $stmt->fetchColumn();
}

/**
 * @param array<int, string> $allowed
 */
function users_api_require_role(string $requesterRole, array $allowed): void
{
    if (!in_array($requesterRole, $allowed, true)) {
        users_api_error(403, 'You are not allowed to perform this action.');
    }
}

/**
 * @param array<string, mixed> $authUser
 * @param array<string, mixed> $metadata
 */
function users_api_audit_log(
    array $authUser,
    string $actionKey,
    string $actionType,
    string $details,
    string $recordType = '',
    string $recordId = '',
    array $metadata = []
): void {
    auth_audit_log([
        'user' => $authUser,
        'action_key' => users_api_text($actionKey, 100),
        'action_type' => users_api_text($actionType, 40),
        'module_name' => 'Settings',
        'record_type' => users_api_text($recordType, 80),
        'record_id' => users_api_text($recordId, 120),
        'details' => users_api_text($details, 255),
        'metadata' => $metadata,
    ]);
}

auth_bootstrap_store();
$authUser = auth_require_api([AUTH_ROLE_CAPTAIN, AUTH_ROLE_ADMIN]);
$pdo = auth_db();
auth_ensure_users_columns($pdo);

$requesterRole = auth_user_role($authUser);
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($requestMethod === 'GET') {
    users_api_respond(200, [
        'success' => true,
        'data' => users_api_settings_payload($pdo, $authUser),
    ]);
}

if ($requestMethod !== 'POST') {
    users_api_error(405, 'Method not allowed.');
}

$csrfToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
if (!auth_csrf_valid($csrfToken)) {
    users_api_error(419, 'Invalid CSRF token.');
}

$payload = users_api_read_json_body();
$action = strtolower(users_api_text($payload['action'] ?? '', 80));

if ($action === '') {
    users_api_error(400, 'Action is required.');
}

try {
    if ($action === 'create_admin_account') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        $fullName = users_api_text($payload['full_name'] ?? '', 120);
        $username = users_api_normalized_username($payload['username'] ?? '');
        $password = (string) ($payload['password'] ?? '');

        if ($fullName === '' || $username === '' || $password === '') {
            users_api_error(422, 'Full name, username, and password are required.');
        }
        if (!users_api_password_min($password)) {
            users_api_error(422, 'Password must be at least 8 characters.');
        }
        if (users_api_find_by_role($pdo, AUTH_ROLE_SECRETARY)) {
            users_api_error(409, 'Admin account already exists. Use reset credentials instead.');
        }
        if (users_api_username_exists($pdo, $username)) {
            users_api_error(409, 'Username already exists.');
        }

        $stmt = $pdo->prepare(
            'INSERT INTO `users` (`full_name`, `username`, `password_hash`, `role`, `contact_number`, `is_active`, `must_change_password`)
             VALUES (:full_name, :username, :password_hash, :role, :contact_number, 1, 1)'
        );
        $stmt->execute([
            'full_name' => $fullName,
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => AUTH_ROLE_SECRETARY,
            'contact_number' => null,
        ]);

        users_api_audit_log(
            $authUser,
            'settings_admin_account_created',
            'created',
            'Created admin account.',
            'user',
            $username,
            [
                'target_role' => AUTH_ROLE_SECRETARY,
                'target_full_name' => $fullName,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Admin account created.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'reset_admin_credentials') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        $adminAccount = users_api_find_by_role($pdo, AUTH_ROLE_SECRETARY);
        if (!is_array($adminAccount)) {
            users_api_error(404, 'Admin account not found.');
        }

        $username = users_api_normalized_username($payload['username'] ?? '');
        $password = (string) ($payload['password'] ?? '');
        if ($username === '' || $password === '') {
            users_api_error(422, 'Username and password are required.');
        }
        if (!users_api_password_min($password)) {
            users_api_error(422, 'Password must be at least 8 characters.');
        }
        $adminAccountId = (int) $adminAccount['id'];
        if (users_api_username_exists($pdo, $username, $adminAccountId)) {
            users_api_error(409, 'Username already exists.');
        }

        $stmt = $pdo->prepare(
            'UPDATE `users`
             SET `username` = :username,
                 `password_hash` = :password_hash,
                 `must_change_password` = 1,
                 `updated_at` = CURRENT_TIMESTAMP
             WHERE `id` = :id AND `role` = :role
             LIMIT 1'
        );
        $stmt->execute([
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'id' => $adminAccountId,
            'role' => AUTH_ROLE_SECRETARY,
        ]);

        users_api_audit_log(
            $authUser,
            'settings_admin_credentials_reset',
            'updated',
            'Reset admin credentials.',
            'user',
            $username,
            [
                'target_role' => AUTH_ROLE_SECRETARY,
                'target_user_id' => $adminAccountId,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Admin credentials reset successfully.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'set_admin_status') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        $adminAccount = users_api_find_by_role($pdo, AUTH_ROLE_SECRETARY);
        if (!is_array($adminAccount)) {
            users_api_error(404, 'Admin account not found.');
        }

        $status = strtolower(users_api_text($payload['status'] ?? '', 20));
        if ($status !== 'active' && $status !== 'deactivated') {
            users_api_error(422, 'Invalid status value.');
        }

        $stmt = $pdo->prepare(
            'UPDATE `users`
             SET `is_active` = :is_active, `updated_at` = CURRENT_TIMESTAMP
             WHERE `id` = :id AND `role` = :role
             LIMIT 1'
        );
        $stmt->execute([
            'is_active' => $status === 'active' ? 1 : 0,
            'id' => (int) $adminAccount['id'],
            'role' => AUTH_ROLE_SECRETARY,
        ]);

        users_api_audit_log(
            $authUser,
            'settings_admin_status_updated',
            'updated',
            $status === 'active' ? 'Activated admin account.' : 'Deactivated admin account.',
            'user',
            (string) ($adminAccount['username'] ?? ''),
            [
                'target_role' => AUTH_ROLE_SECRETARY,
                'target_user_id' => (int) ($adminAccount['id'] ?? 0),
                'status' => $status,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => $status === 'active' ? 'Admin account activated.' : 'Admin account deactivated.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'update_own_credentials') {
        users_api_require_role($requesterRole, [AUTH_ROLE_ADMIN, AUTH_ROLE_CAPTAIN]);

        $userId = (int) ($authUser['id'] ?? 0);
        if ($userId <= 0) {
            users_api_error(401, 'Invalid session.');
        }

        $currentRow = users_api_find_user($pdo, $userId);
        if (!is_array($currentRow)) {
            users_api_error(404, 'Account not found.');
        }
        if ((int) ($currentRow['is_active'] ?? 0) !== 1) {
            users_api_error(403, 'Your account is deactivated.');
        }

        $currentUsername = users_api_normalized_username($payload['current_username'] ?? '');
        $currentPassword = (string) ($payload['current_password'] ?? '');
        $newUsername = users_api_normalized_username($payload['new_username'] ?? '');
        $newPassword = (string) ($payload['new_password'] ?? '');

        if ($currentUsername === '' || $currentPassword === '' || $newUsername === '' || $newPassword === '') {
            users_api_error(422, 'All credential fields are required.');
        }
        if (!users_api_password_strong($newPassword)) {
            users_api_error(422, 'New password must be at least 8 characters and include 1 special character.');
        }

        $storedUsername = (string) ($currentRow['username'] ?? '');
        $passwordHash = (string) ($currentRow['password_hash'] ?? '');
        if ($currentUsername !== $storedUsername || !password_verify($currentPassword, $passwordHash)) {
            users_api_error(422, 'Current username or password is incorrect.');
        }

        if (users_api_username_exists($pdo, $newUsername, $userId)) {
            users_api_error(409, 'Username already exists.');
        }

        $samePassword = password_verify($newPassword, $passwordHash);
        if ($newUsername === $storedUsername && $samePassword) {
            users_api_error(422, 'New credentials must be different from current credentials.');
        }

        $stmt = $pdo->prepare(
            'UPDATE `users`
             SET `username` = :username,
                 `password_hash` = :password_hash,
                 `must_change_password` = 0,
                 `updated_at` = CURRENT_TIMESTAMP
             WHERE `id` = :id
             LIMIT 1'
        );
        $stmt->execute([
            'username' => $newUsername,
            'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            'id' => $userId,
        ]);

        $updatedRow = users_api_find_user($pdo, $userId);
        if (is_array($updatedRow)) {
            users_api_refresh_session_user($updatedRow);
            $authUser = $_SESSION[AUTH_SESSION_USER_KEY];
        }

        users_api_audit_log(
            is_array($authUser) ? $authUser : [],
            'settings_own_credentials_updated',
            'security',
            'Updated own credentials.',
            'user',
            $newUsername,
            [
                'user_id' => $userId,
                'old_username' => $storedUsername,
                'new_username' => $newUsername,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Credentials updated successfully.',
            'data' => users_api_settings_payload($pdo, is_array($authUser) ? $authUser : []),
        ]);
    }

    if ($action === 'create_staff') {
        users_api_require_role($requesterRole, [AUTH_ROLE_ADMIN]);

        $fullName = users_api_text($payload['full_name'] ?? '', 120);
        $username = users_api_normalized_username($payload['username'] ?? '');
        $password = (string) ($payload['password'] ?? '');
        $contactNumber = users_api_text($payload['contact_number'] ?? '', 40);

        if ($fullName === '' || $username === '' || $password === '' || $contactNumber === '') {
            users_api_error(422, 'Full name, username, password, and contact number are required.');
        }
        if (!users_api_password_strong($password)) {
            users_api_error(422, 'Password must be at least 8 characters and include 1 special character.');
        }
        if (users_api_username_exists($pdo, $username)) {
            users_api_error(409, 'Username already exists.');
        }

        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM `users` WHERE `role` = :role');
        $countStmt->execute(['role' => AUTH_ROLE_STAFF]);
        $staffCount = (int) $countStmt->fetchColumn();
        if ($staffCount >= 5) {
            users_api_error(422, 'Cannot create more than 5 staff accounts.');
        }

        $stmt = $pdo->prepare(
            'INSERT INTO `users` (`full_name`, `username`, `password_hash`, `password_plain`, `role`, `contact_number`, `is_active`, `must_change_password`)
             VALUES (:full_name, :username, :password_hash, :password_plain, :role, :contact_number, 1, 0)'
        );
        $stmt->execute([
            'full_name' => $fullName,
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'password_plain' => $password,
            'role' => AUTH_ROLE_STAFF,
            'contact_number' => $contactNumber,
        ]);

        users_api_audit_log(
            $authUser,
            'settings_staff_created',
            'created',
            'Created staff account.',
            'user',
            $username,
            [
                'target_role' => AUTH_ROLE_STAFF,
                'target_full_name' => $fullName,
                'contact_number' => $contactNumber,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Staff account created successfully.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'set_staff_status') {
        users_api_require_role($requesterRole, [AUTH_ROLE_ADMIN]);

        $staffId = (int) ($payload['staff_id'] ?? 0);
        $status = strtolower(users_api_text($payload['status'] ?? '', 20));
        if ($staffId <= 0 || ($status !== 'active' && $status !== 'deactivated')) {
            users_api_error(422, 'Invalid staff status payload.');
        }

        $stmt = $pdo->prepare(
            'UPDATE `users`
             SET `is_active` = :is_active, `updated_at` = CURRENT_TIMESTAMP
             WHERE `id` = :id AND `role` = :role
             LIMIT 1'
        );
        $stmt->execute([
            'is_active' => $status === 'active' ? 1 : 0,
            'id' => $staffId,
            'role' => AUTH_ROLE_STAFF,
        ]);

        if ($stmt->rowCount() === 0) {
            users_api_error(404, 'Staff account not found.');
        }

        users_api_audit_log(
            $authUser,
            'settings_staff_status_updated',
            'updated',
            $status === 'active' ? 'Activated staff account.' : 'Deactivated staff account.',
            'user',
            (string) $staffId,
            [
                'target_role' => AUTH_ROLE_STAFF,
                'target_user_id' => $staffId,
                'status' => $status,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => $status === 'active' ? 'Staff account activated.' : 'Staff account deactivated.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'delete_staff') {
        users_api_require_role($requesterRole, [AUTH_ROLE_ADMIN]);

        $staffId = (int) ($payload['staff_id'] ?? 0);
        if ($staffId <= 0) {
            users_api_error(422, 'Invalid staff account id.');
        }

        $stmt = $pdo->prepare('DELETE FROM `users` WHERE `id` = :id AND `role` = :role LIMIT 1');
        $stmt->execute([
            'id' => $staffId,
            'role' => AUTH_ROLE_STAFF,
        ]);
        if ($stmt->rowCount() === 0) {
            users_api_error(404, 'Staff account not found.');
        }

        users_api_audit_log(
            $authUser,
            'settings_staff_deleted',
            'deleted',
            'Deleted staff account.',
            'user',
            (string) $staffId,
            [
                'target_role' => AUTH_ROLE_STAFF,
                'target_user_id' => $staffId,
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Staff account deleted.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    users_api_error(400, 'Unsupported action.');
} catch (Throwable $exception) {
    users_api_error(500, 'Unable to process request right now.');
}
