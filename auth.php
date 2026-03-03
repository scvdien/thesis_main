<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const AUTH_SESSION_USER_KEY = 'auth_user';
const AUTH_SESSION_LAST_ACTIVITY_KEY = 'auth_last_activity';
const AUTH_SESSION_CSRF_KEY = 'auth_csrf_token';
const AUTH_IDLE_TIMEOUT_SECONDS = 60 * 60 * 4;
const AUTH_PRESENCE_OFFLINE_AFTER_SECONDS = 60 * 2;
const AUTH_PRESENCE_HEARTBEAT_INTERVAL_MS = 15 * 1000;

const AUTH_ROLE_ADMIN = 'admin';
// Legacy value kept for backward compatibility with existing rows/actions.
const AUTH_ROLE_SECRETARY = 'secretary';
const AUTH_ROLE_CAPTAIN = 'captain';
const AUTH_ROLE_STAFF = 'staff';

/**
 * @return array<int, string>
 */
function auth_roles(): array
{
    return [
        AUTH_ROLE_ADMIN,
        AUTH_ROLE_CAPTAIN,
        AUTH_ROLE_STAFF,
    ];
}

/**
 * @param array<int, string> $keys
 */
function auth_env(array $keys, string $default = ''): string
{
    foreach ($keys as $key) {
        if (isset($_ENV[$key]) && trim((string) $_ENV[$key]) !== '') {
            return trim((string) $_ENV[$key]);
        }
        if (isset($_SERVER[$key]) && trim((string) $_SERVER[$key]) !== '') {
            return trim((string) $_SERVER[$key]);
        }
        $value = getenv($key);
        if ($value !== false && trim((string) $value) !== '') {
            return trim((string) $value);
        }
    }
    return $default;
}

function auth_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('hims_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function auth_normalize_role(string $role): string
{
    $normalized = strtolower(trim($role));
    $aliases = [
        'administrator' => AUTH_ROLE_ADMIN,
        'barangay secretary' => AUTH_ROLE_ADMIN,
        'registration staff' => AUTH_ROLE_STAFF,
        'staff' => AUTH_ROLE_STAFF,
        'captain' => AUTH_ROLE_CAPTAIN,
        // Secretary is now treated as Admin for module access.
        'secretary' => AUTH_ROLE_ADMIN,
        'admin' => AUTH_ROLE_ADMIN,
    ];
    if (isset($aliases[$normalized])) {
        return $aliases[$normalized];
    }
    return in_array($normalized, auth_roles(), true) ? $normalized : '';
}

function auth_role_label(string $role): string
{
    return match (auth_normalize_role($role)) {
        AUTH_ROLE_ADMIN => 'Admin',
        AUTH_ROLE_CAPTAIN => 'Captain',
        AUTH_ROLE_STAFF => 'Staff',
        default => 'Unknown',
    };
}

function auth_role_home(string $role): string
{
    return match (auth_normalize_role($role)) {
        AUTH_ROLE_ADMIN => 'admin.php',
        AUTH_ROLE_CAPTAIN => 'index.php',
        AUTH_ROLE_STAFF => 'registration.php',
        default => 'login.php',
    };
}

function auth_set_last_denial_reason(string $reason): void
{
    $GLOBALS['__auth_last_denial_reason'] = $reason;
}

function auth_last_denial_reason(): string
{
    $value = $GLOBALS['__auth_last_denial_reason'] ?? '';
    return is_string($value) ? $value : '';
}

/**
 * @param array<string, mixed> $sessionUser
 * @return array{state: string, user: array<string, mixed>}
 */
function auth_sync_session_user(array $sessionUser): array
{
    $sessionRole = auth_normalize_role((string) ($sessionUser['role'] ?? ''));
    if ($sessionRole === '') {
        return [
            'state' => 'invalid_role',
            'user' => $sessionUser,
        ];
    }

    $sessionUser['role'] = $sessionRole;
    $userId = (int) ($sessionUser['id'] ?? 0);
    if ($userId <= 0) {
        return [
            'state' => 'invalid_user',
            'user' => $sessionUser,
        ];
    }

    try {
        $pdo = auth_db();
        $stmt = $pdo->prepare(
            'SELECT `id`, `full_name`, `username`, `role`, `is_active`, `must_change_password`
             FROM `users`
             WHERE `id` = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $exception) {
        // Keep existing session on transient database issues.
        return [
            'state' => 'unverified',
            'user' => $sessionUser,
        ];
    }

    if (!is_array($row)) {
        return [
            'state' => 'account_not_found',
            'user' => $sessionUser,
        ];
    }

    if ((int) ($row['is_active'] ?? 0) !== 1) {
        return [
            'state' => 'account_deactivated',
            'user' => $sessionUser,
        ];
    }

    $role = auth_normalize_role((string) ($row['role'] ?? ''));
    if ($role === '') {
        return [
            'state' => 'invalid_role',
            'user' => $sessionUser,
        ];
    }

    return [
        'state' => 'active',
        'user' => [
            'id' => (int) ($row['id'] ?? 0),
            'full_name' => (string) ($row['full_name'] ?? ''),
            'username' => (string) ($row['username'] ?? ''),
            'role' => $role,
            'requires_credential_update' => (int) ($row['must_change_password'] ?? 0) === 1,
        ],
    ];
}

/**
 * @return array<string, mixed>|null
 */
function auth_current_user(): ?array
{
    auth_set_last_denial_reason('');
    auth_start_session();

    if (!isset($_SESSION[AUTH_SESSION_USER_KEY]) || !is_array($_SESSION[AUTH_SESSION_USER_KEY])) {
        return null;
    }

    if (isset($_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY])) {
        $lastActivity = (int) $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY];
        if ($lastActivity > 0 && (time() - $lastActivity) > AUTH_IDLE_TIMEOUT_SECONDS) {
            auth_set_last_denial_reason('idle_timeout');
            auth_logout();
            return null;
        }
    }

    $user = $_SESSION[AUTH_SESSION_USER_KEY];
    $syncResult = auth_sync_session_user($user);
    if (($syncResult['state'] ?? '') !== 'active' && ($syncResult['state'] ?? '') !== 'unverified') {
        auth_set_last_denial_reason((string) ($syncResult['state'] ?? 'invalid_session'));
        auth_logout();
        return null;
    }

    $user = ($syncResult['state'] ?? '') === 'active'
        ? (array) ($syncResult['user'] ?? [])
        : (array) ($syncResult['user'] ?? $user);

    $userRole = auth_normalize_role((string) ($user['role'] ?? ''));
    if ($userRole === '') {
        auth_set_last_denial_reason('invalid_role');
        auth_logout();
        return null;
    }

    $user['role'] = $userRole;
    $_SESSION[AUTH_SESSION_USER_KEY] = $user;
    $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY] = time();
    auth_mark_user_presence($user, true);
    return $user;
}

function auth_is_logged_in(): bool
{
    return auth_current_user() !== null;
}

function auth_user_role(array $user): string
{
    return auth_normalize_role((string) ($user['role'] ?? ''));
}

function auth_redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}

function auth_logout(): void
{
    auth_start_session();

    $currentUser = isset($_SESSION[AUTH_SESSION_USER_KEY]) && is_array($_SESSION[AUTH_SESSION_USER_KEY])
        ? $_SESSION[AUTH_SESSION_USER_KEY]
        : null;
    if (is_array($currentUser)) {
        auth_mark_user_presence($currentUser, false);
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
}

/**
 * @param array<string, mixed> $user
 */
function auth_presence_user_id(array $user): int
{
    return (int) ($user['id'] ?? 0);
}

function auth_presence_is_online(mixed $lastSeenAt): bool
{
    $lastSeen = trim((string) $lastSeenAt);
    if ($lastSeen === '') {
        return false;
    }

    $timestamp = strtotime($lastSeen);
    if ($timestamp === false) {
        return false;
    }

    return (time() - $timestamp) <= AUTH_PRESENCE_OFFLINE_AFTER_SECONDS;
}

function auth_mark_user_presence_with_pdo(PDO $pdo, int $userId, bool $online): void
{
    if ($userId <= 0) {
        return;
    }

    $stmt = $pdo->prepare(
        'UPDATE `users`
         SET `last_seen_at` = :last_seen_at
         WHERE `id` = :id
         LIMIT 1'
    );
    $stmt->execute([
        'last_seen_at' => $online ? date('Y-m-d H:i:s') : null,
        'id' => $userId,
    ]);
}

/**
 * @param array<string, mixed> $user
 */
function auth_mark_user_presence(array $user, bool $online = true): void
{
    $userId = auth_presence_user_id($user);
    if ($userId <= 0) {
        return;
    }
    static $requestPresenceState = [];
    $requestKey = $userId . ':' . ($online ? '1' : '0');
    if (isset($requestPresenceState[$requestKey])) {
        return;
    }
    $requestPresenceState[$requestKey] = true;

    try {
        $pdo = auth_db();
        auth_mark_user_presence_with_pdo($pdo, $userId, $online);
    } catch (Throwable $exception) {
        // Presence updates are best-effort and should not break requests.
    }
}

function auth_db(): PDO
{
    return db_connection(
        static fn(array $keys, string $default = ''): string => auth_env($keys, $default)
    );
}

function auth_bootstrap_users_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `users` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `full_name` VARCHAR(120) NOT NULL,
            `username` VARCHAR(80) NOT NULL,
            `password_hash` VARCHAR(255) NOT NULL,
            `password_plain` VARCHAR(255) NULL,
            `role` VARCHAR(20) NOT NULL,
            `contact_number` VARCHAR(40) NULL,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `last_seen_at` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_users_username` (`username`),
            KEY `idx_users_role` (`role`),
            KEY `idx_users_last_seen_at` (`last_seen_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function auth_users_has_column(PDO $pdo, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name
         LIMIT 1'
    );
    $stmt->execute([
        'table_name' => 'users',
        'column_name' => $column,
    ]);
    return (bool) $stmt->fetchColumn();
}

function auth_ensure_users_columns(PDO $pdo): void
{
    if (!auth_users_has_column($pdo, 'password_plain')) {
        $pdo->exec('ALTER TABLE `users` ADD COLUMN `password_plain` VARCHAR(255) NULL AFTER `password_hash`');
    }
    if (!auth_users_has_column($pdo, 'contact_number')) {
        $pdo->exec('ALTER TABLE `users` ADD COLUMN `contact_number` VARCHAR(40) NULL AFTER `role`');
    }
    if (!auth_users_has_column($pdo, 'must_change_password')) {
        $pdo->exec('ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`');
    }
    if (!auth_users_has_column($pdo, 'last_seen_at')) {
        $pdo->exec('ALTER TABLE `users` ADD COLUMN `last_seen_at` DATETIME NULL DEFAULT NULL AFTER `updated_at`');
    }
}

function auth_seed_default_users(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM `users`')->fetchColumn();
    if ($count > 0) {
        return;
    }

    $defaults = [
        ['Barangay Secretary', 'secretary', 'Secretary@123', AUTH_ROLE_SECRETARY],
        ['Barangay Captain', 'captain', 'Captain@123', AUTH_ROLE_CAPTAIN],
        ['Registration Staff', 'staff', 'Staff@123', AUTH_ROLE_STAFF],
    ];

    $stmt = $pdo->prepare(
        'INSERT INTO `users` (`full_name`, `username`, `password_hash`, `password_plain`, `role`, `is_active`)
         VALUES (:full_name, :username, :password_hash, :password_plain, :role, 1)'
    );

    foreach ($defaults as [$fullName, $username, $password, $role]) {
        $stmt->execute([
            'full_name' => $fullName,
            'username' => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'password_plain' => $role === AUTH_ROLE_STAFF ? $password : null,
            'role' => $role,
        ]);
    }
}

function auth_bootstrap_audit_trail_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `audit_trail_logs` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `actor_user_id` BIGINT UNSIGNED NULL,
            `actor_username` VARCHAR(80) NOT NULL DEFAULT "",
            `actor_role` VARCHAR(20) NOT NULL DEFAULT "",
            `action_key` VARCHAR(100) NOT NULL,
            `action_type` VARCHAR(40) NOT NULL DEFAULT "",
            `module_name` VARCHAR(80) NOT NULL DEFAULT "",
            `record_type` VARCHAR(80) NOT NULL DEFAULT "",
            `record_id` VARCHAR(120) NOT NULL DEFAULT "",
            `details` VARCHAR(255) NOT NULL DEFAULT "",
            `metadata_json` LONGTEXT NULL,
            `ip_address` VARCHAR(64) NOT NULL DEFAULT "",
            `user_agent` VARCHAR(255) NOT NULL DEFAULT "",
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_audit_trail_created_at` (`created_at`),
            KEY `idx_audit_trail_actor_user_id` (`actor_user_id`),
            KEY `idx_audit_trail_action_type` (`action_type`),
            KEY `idx_audit_trail_module_name` (`module_name`),
            KEY `idx_audit_trail_actor_role` (`actor_role`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function auth_audit_text(mixed $value, int $maxLength = 255): string
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

function auth_request_ip(): string
{
    $forwardedFor = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($forwardedFor !== '') {
        $first = trim(explode(',', $forwardedFor)[0] ?? '');
        if ($first !== '') {
            return auth_audit_text($first, 64);
        }
    }
    return auth_audit_text((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 64);
}

/**
 * @param array<string, mixed> $entry
 */
function auth_audit_log(array $entry): void
{
    try {
        $pdo = auth_db();
        auth_bootstrap_audit_trail_table($pdo);

        $user = is_array($entry['user'] ?? null) ? $entry['user'] : [];
        $actorUserId = (int) ($entry['actor_user_id'] ?? ($user['id'] ?? 0));
        $actorUsername = auth_audit_text((string) ($entry['actor_username'] ?? ($user['username'] ?? '')), 80);
        $actorRole = auth_normalize_role((string) ($entry['actor_role'] ?? ($user['role'] ?? '')));
        if ($actorRole === '') {
            $actorRole = auth_audit_text((string) ($entry['actor_role'] ?? ($user['role'] ?? '')), 20);
        }
        $actionKey = auth_audit_text((string) ($entry['action_key'] ?? ''), 100);
        if ($actionKey === '') {
            return;
        }
        $actionType = auth_audit_text((string) ($entry['action_type'] ?? ''), 40);
        $moduleName = auth_audit_text((string) ($entry['module_name'] ?? ''), 80);
        $recordType = auth_audit_text((string) ($entry['record_type'] ?? ''), 80);
        $recordId = auth_audit_text((string) ($entry['record_id'] ?? ''), 120);
        $details = auth_audit_text((string) ($entry['details'] ?? ''), 255);
        $ipAddress = auth_audit_text((string) ($entry['ip_address'] ?? auth_request_ip()), 64);
        $userAgent = auth_audit_text((string) ($entry['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '')), 255);

        $metadata = $entry['metadata'] ?? null;
        $metadataJson = null;
        if ($metadata !== null) {
            $encoded = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (is_string($encoded)) {
                $metadataJson = $encoded;
            }
        }

        $stmt = $pdo->prepare(
            'INSERT INTO `audit_trail_logs`
             (`actor_user_id`, `actor_username`, `actor_role`, `action_key`, `action_type`, `module_name`,
              `record_type`, `record_id`, `details`, `metadata_json`, `ip_address`, `user_agent`)
             VALUES
             (:actor_user_id, :actor_username, :actor_role, :action_key, :action_type, :module_name,
              :record_type, :record_id, :details, :metadata_json, :ip_address, :user_agent)'
        );
        $stmt->execute([
            'actor_user_id' => $actorUserId > 0 ? $actorUserId : null,
            'actor_username' => $actorUsername,
            'actor_role' => $actorRole,
            'action_key' => $actionKey,
            'action_type' => $actionType,
            'module_name' => $moduleName,
            'record_type' => $recordType,
            'record_id' => $recordId,
            'details' => $details,
            'metadata_json' => $metadataJson,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);
    } catch (Throwable $exception) {
        // Audit logging should never interrupt core workflows.
    }
}

function auth_bootstrap_store(): void
{
    static $bootstrapped = false;
    if ($bootstrapped) {
        return;
    }

    $pdo = auth_db();
    auth_bootstrap_users_table($pdo);
    auth_ensure_users_columns($pdo);
    auth_seed_default_users($pdo);
    auth_bootstrap_audit_trail_table($pdo);
    $bootstrapped = true;
}

/**
 * @return array{success: bool, error: string, user: array<string, mixed>|null}
 */
function auth_attempt_login(string $username, string $password, string $selectedRole = ''): array
{
    $username = trim($username);
    $selectedRoleRaw = trim($selectedRole);
    $selectedRole = $selectedRoleRaw === '' ? '' : auth_normalize_role($selectedRoleRaw);
    $auditLogin = static function (bool $success, string $message, array $context = []) use ($username, $selectedRoleRaw, $selectedRole): void {
        $contextRole = auth_normalize_role((string) ($context['role'] ?? $context['stored_role'] ?? $context['selected_role'] ?? ''));
        $actorRole = $contextRole !== '' ? $contextRole : $selectedRole;
        $actionKey = $success ? 'login_success' : 'login_failed';
        auth_audit_log([
            'actor_username' => $username,
            'actor_role' => $actorRole,
            'action_key' => $actionKey,
            'action_type' => $success ? 'access' : 'security',
            'module_name' => 'Authentication',
            'record_type' => 'session',
            'record_id' => $username,
            'details' => $message,
            'metadata' => [
                'username_input' => $username,
                'selected_role_input' => $selectedRoleRaw,
                'success' => $success,
                'context' => $context,
            ],
        ]);
    };

    if ($username === '' || $password === '') {
        $auditLogin(false, 'Login failed: missing username or password.');
        return [
            'success' => false,
            'error' => 'Please provide username and password.',
            'user' => null,
        ];
    }

    if ($selectedRoleRaw !== '' && $selectedRole === '') {
        $auditLogin(false, 'Login failed: selected role is invalid.', [
            'selected_role' => $selectedRoleRaw,
        ]);
        return [
            'success' => false,
            'error' => 'Selected role is invalid.',
            'user' => null,
        ];
    }

    auth_bootstrap_store();
    $pdo = auth_db();

    $stmt = $pdo->prepare(
        'SELECT `id`, `full_name`, `username`, `password_hash`, `role`, `is_active`, `must_change_password`
         FROM `users`
         WHERE `username` = :username
         LIMIT 1'
    );
    $stmt->execute(['username' => $username]);
    $row = $stmt->fetch();

    if (!is_array($row)) {
        $auditLogin(false, 'Login failed: username not found.');
        return [
            'success' => false,
            'error' => 'Invalid username or password.',
            'user' => null,
        ];
    }

    // Enforce exact username casing (e.g. "Admin" !== "admin") even if DB collation is case-insensitive.
    $storedUsername = (string) ($row['username'] ?? '');
    if ($storedUsername === '' || $storedUsername !== $username) {
        $auditLogin(false, 'Login failed: username casing mismatch.');
        return [
            'success' => false,
            'error' => 'Invalid username or password.',
            'user' => null,
        ];
    }

    if ((int) ($row['is_active'] ?? 0) !== 1) {
        $auditLogin(false, 'Login failed: account is disabled.', [
            'user_id' => (int) ($row['id'] ?? 0),
            'role' => (string) ($row['role'] ?? ''),
        ]);
        return [
            'success' => false,
            'error' => 'This account is disabled.',
            'user' => null,
        ];
    }

    $storedRole = auth_normalize_role((string) ($row['role'] ?? ''));
    if ($storedRole === '') {
        $auditLogin(false, 'Login failed: account role is invalid.', [
            'user_id' => (int) ($row['id'] ?? 0),
        ]);
        return [
            'success' => false,
            'error' => 'Account role is invalid. Contact administrator.',
            'user' => null,
        ];
    }

    if ($selectedRole !== '' && $selectedRole !== $storedRole) {
        $auditLogin(false, 'Login failed: selected role mismatch.', [
            'user_id' => (int) ($row['id'] ?? 0),
            'stored_role' => $storedRole,
            'selected_role' => $selectedRole,
        ]);
        return [
            'success' => false,
            'error' => 'Selected role does not match this account.',
            'user' => null,
        ];
    }

    $hash = (string) ($row['password_hash'] ?? '');
    if (!password_verify($password, $hash)) {
        $auditLogin(false, 'Login failed: invalid password.', [
            'user_id' => (int) ($row['id'] ?? 0),
            'stored_role' => $storedRole,
        ]);
        return [
            'success' => false,
            'error' => 'Invalid username or password.',
            'user' => null,
        ];
    }

    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        $rehashStmt = $pdo->prepare('UPDATE `users` SET `password_hash` = :hash WHERE `id` = :id');
        $rehashStmt->execute([
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'id' => (int) $row['id'],
        ]);
    }

    $user = [
        'id' => (int) $row['id'],
        'full_name' => (string) $row['full_name'],
        'username' => (string) $row['username'],
        'role' => $storedRole,
        'requires_credential_update' => (int) ($row['must_change_password'] ?? 0) === 1,
    ];

    auth_start_session();
    session_regenerate_id(true);
    $_SESSION[AUTH_SESSION_USER_KEY] = $user;
    $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY] = time();
    try {
        auth_mark_user_presence_with_pdo($pdo, (int) ($user['id'] ?? 0), true);
    } catch (Throwable $exception) {
        // Presence updates are best-effort and should not block login.
    }

    $auditLogin(true, 'Login successful.', [
        'user_id' => (int) ($user['id'] ?? 0),
        'role' => (string) ($user['role'] ?? ''),
    ]);

    return [
        'success' => true,
        'error' => '',
        'user' => $user,
    ];
}

/**
 * @param array<int, string> $allowedRoles
 * @return array<string, mixed>
 */
function auth_require_page(array $allowedRoles = []): array
{
    $user = auth_current_user();
    if (!is_array($user)) {
        auth_redirect('login.php');
    }

    $role = auth_user_role($user);
    $normalizedAllowed = array_values(array_filter(array_map('auth_normalize_role', $allowedRoles)));
    if ($normalizedAllowed && !in_array($role, $normalizedAllowed, true)) {
        auth_redirect(auth_role_home($role));
    }

    return $user;
}

function auth_json_error(int $statusCode, string $message, string $code = ''): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    $payload = [
        'success' => false,
        'error' => $message,
    ];
    if ($code !== '') {
        $payload['code'] = $code;
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * @param array<int, string> $allowedRoles
 * @return array<string, mixed>
 */
function auth_require_api(array $allowedRoles = []): array
{
    $user = auth_current_user();
    if (!is_array($user)) {
        $reason = auth_last_denial_reason();
        if ($reason === 'account_deactivated') {
            auth_json_error(403, 'Your account is deactivated.', 'account_deactivated');
        }
        if ($reason === 'idle_timeout') {
            auth_json_error(401, 'Session expired. Please log in again.', 'session_expired');
        }
        if ($reason === 'account_not_found') {
            auth_json_error(401, 'Account not found.', 'account_not_found');
        }
        auth_json_error(401, 'Authentication required.');
    }

    $role = auth_user_role($user);
    $normalizedAllowed = array_values(array_filter(array_map('auth_normalize_role', $allowedRoles)));
    if ($normalizedAllowed && !in_array($role, $normalizedAllowed, true)) {
        auth_json_error(403, 'You do not have permission for this action.');
    }

    return $user;
}

function auth_csrf_token(): string
{
    auth_start_session();
    if (empty($_SESSION[AUTH_SESSION_CSRF_KEY]) || !is_string($_SESSION[AUTH_SESSION_CSRF_KEY])) {
        $_SESSION[AUTH_SESSION_CSRF_KEY] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION[AUTH_SESSION_CSRF_KEY];
}

function auth_csrf_valid(?string $token): bool
{
    auth_start_session();
    if (!is_string($token) || $token === '') {
        return false;
    }
    $stored = $_SESSION[AUTH_SESSION_CSRF_KEY] ?? '';
    return is_string($stored) && $stored !== '' && hash_equals($stored, $token);
}

function auth_client_role_script(string $role): string
{
    $normalizedRole = auth_normalize_role($role);
    if ($normalizedRole === '') {
        return '';
    }

    $jsonRole = json_encode($normalizedRole, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($jsonRole)) {
        return '';
    }

    $scriptTemplate = <<<'HTML'
<script>(function(){
  var role=__ROLE__;
  var endpoint="auth-presence.php";
  var heartbeatMs=__HEARTBEAT_MS__;
  var inFlight=false;
  var deactivationHandled=false;

  try{sessionStorage.setItem("userRole",role);}catch(e){}
  window.__AUTH_ROLE=role;
  if(document.body){document.body.dataset.role=role;}

  var redirectToLogout=function(){
    window.location.href="logout.php?reason=deactivated";
  };

  var showDeactivationModal=function(){
    if(deactivationHandled){return;}
    deactivationHandled=true;

    var mount=function(){
      if(document.getElementById("authDeactivatedModal")){return;}
      var overlay=document.createElement("div");
      overlay.id="authDeactivatedModal";
      overlay.setAttribute("role","alertdialog");
      overlay.setAttribute("aria-modal","true");
      overlay.style.position="fixed";
      overlay.style.top="0";
      overlay.style.right="0";
      overlay.style.bottom="0";
      overlay.style.left="0";
      overlay.style.zIndex="2147483647";
      overlay.style.display="flex";
      overlay.style.alignItems="center";
      overlay.style.justifyContent="center";
      overlay.style.padding="16px";
      overlay.style.background="rgba(0,0,0,0.55)";
      overlay.innerHTML='<div style="width:100%;max-width:420px;background:#fff;border-radius:12px;padding:20px 20px 16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);font-family:Arial,sans-serif;text-align:center;"><h2 style="margin:0 0 10px;font-size:20px;color:#1f2937;">Account Deactivated</h2><p style="margin:0 0 16px;color:#4b5563;font-size:14px;">Your account is deactivated. You will be logged out.</p><button type="button" id="authDeactivatedModalBtn" style="display:inline-block;border:0;border-radius:8px;background:#dc2626;color:#fff;padding:10px 16px;font-size:14px;cursor:pointer;">Logout</button></div>';
      document.body.appendChild(overlay);
      var button=document.getElementById("authDeactivatedModalBtn");
      if(button&&typeof button.addEventListener==="function"){
        button.addEventListener("click",redirectToLogout,{once:true});
      }
    };

    if(document.body){
      mount();
    }else if(document&&typeof document.addEventListener==="function"){
      document.addEventListener("DOMContentLoaded",mount,{once:true});
    }

    if(typeof window.setTimeout==="function"){
      window.setTimeout(redirectToLogout,1800);
    }else{
      redirectToLogout();
    }
  };

  var parseJson=function(response){
    try{
      if(response&&typeof response.json==="function"){
        return response.json();
      }
    }catch(e){}
    return Promise.resolve(null);
  };

  var handleFailedPing=function(response){
    return parseJson(response).then(function(payload){
      var code=(payload&&typeof payload.code==="string")?payload.code:"";
      if(response&&response.status===403&&code==="account_deactivated"){
        showDeactivationModal();
      }
    }).catch(function(){});
  };

  var ping=function(){
    if(inFlight||deactivationHandled){return;}
    inFlight=true;
    fetch(endpoint,{method:"GET",credentials:"same-origin",cache:"no-store",keepalive:true})
      .then(function(response){
        if(response&&response.ok){return;}
        return handleFailedPing(response);
      })
      .catch(function(){})
      .then(function(){inFlight=false;},function(){inFlight=false;});
  };

  ping();
  if(typeof window.setInterval==="function"){window.setInterval(ping,heartbeatMs);}
  if(document&&typeof document.addEventListener==="function"){
    document.addEventListener("visibilitychange",function(){if(!document.hidden){ping();}});
  }
  if(window&&typeof window.addEventListener==="function"){window.addEventListener("focus",ping);}
})();</script>
HTML;

    return strtr($scriptTemplate, [
        '__ROLE__' => $jsonRole,
        '__HEARTBEAT_MS__' => (string) AUTH_PRESENCE_HEARTBEAT_INTERVAL_MS,
    ]);
}
