<?php
declare(strict_types=1);

const AUTH_SESSION_USER_KEY = 'auth_user';
const AUTH_SESSION_LAST_ACTIVITY_KEY = 'auth_last_activity';
const AUTH_SESSION_CSRF_KEY = 'auth_csrf_token';
const AUTH_IDLE_TIMEOUT_SECONDS = 60 * 60 * 4;

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

/**
 * @return array<string, mixed>|null
 */
function auth_current_user(): ?array
{
    auth_start_session();

    if (!isset($_SESSION[AUTH_SESSION_USER_KEY]) || !is_array($_SESSION[AUTH_SESSION_USER_KEY])) {
        return null;
    }

    if (isset($_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY])) {
        $lastActivity = (int) $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY];
        if ($lastActivity > 0 && (time() - $lastActivity) > AUTH_IDLE_TIMEOUT_SECONDS) {
            auth_logout();
            return null;
        }
    }

    $user = $_SESSION[AUTH_SESSION_USER_KEY];
    $userRole = auth_normalize_role((string) ($user['role'] ?? ''));
    if ($userRole === '') {
        auth_logout();
        return null;
    }

    $user['role'] = $userRole;
    $_SESSION[AUTH_SESSION_LAST_ACTIVITY_KEY] = time();
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

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
    }
    session_destroy();
}

function auth_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!class_exists('PDO')) {
        throw new RuntimeException('PDO extension is not available.');
    }

    $host = auth_env(['DB_HOST'], '127.0.0.1');
    $port = auth_env(['DB_PORT'], '3306');
    $username = auth_env(['DB_USERNAME', 'DB_USER'], 'root');
    $password = auth_env(['DB_PASSWORD', 'DB_PASS'], '');
    $database = auth_env(['DB_NAME'], 'thesis_main');

    if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
        throw new RuntimeException('Invalid database name.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $username, $password, $options);
        return $pdo;
    } catch (Throwable $exception) {
        // Fallback: try creating the database when it does not exist yet.
    }

    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $username, $password, $options);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$database}`");

    return $pdo;
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
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_users_username` (`username`),
            KEY `idx_users_role` (`role`)
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
    $auditLogin = static function (bool $success, string $message, array $context = []) use ($username, $selectedRoleRaw): void {
        $actionKey = $success ? 'login_success' : 'login_failed';
        auth_audit_log([
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

function auth_json_error(int $statusCode, string $message): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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

    return '<script>(function(){var role='
        . $jsonRole
        . ';try{sessionStorage.setItem("userRole",role);}catch(e){}window.__AUTH_ROLE=role;if(document.body){document.body.dataset.role=role;}})();</script>';
}
