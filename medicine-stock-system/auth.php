<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

if (!headers_sent()) {
    date_default_timezone_set('Asia/Manila');
}

function mss_auth_now(): string
{
    return date('Y-m-d H:i:s');
}

function mss_auth_session_name(): string
{
    return 'mss_session';
}

function mss_auth_token_cookie_name(): string
{
    return 'mss_auth_token';
}

function mss_auth_cookie_path(): string
{
    $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/'));
    $path = str_replace('\\', '/', dirname($scriptName));
    if ($path === '' || $path === '.' || $path === '\\') {
        return '/';
    }

    return rtrim($path, '/') . '/';
}

function mss_auth_is_secure_request(): bool
{
    $https = strtolower(trim((string) ($_SERVER['HTTPS'] ?? '')));
    if ($https !== '' && $https !== 'off' && $https !== '0') {
        return true;
    }

    $forwardedProto = strtolower(trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
    return $forwardedProto === 'https';
}

function mss_auth_set_cookie(string $name, string $value, int $expiresAt = 0): void
{
    if (headers_sent()) {
        return;
    }

    $options = [
        'expires' => $expiresAt,
        'path' => mss_auth_cookie_path(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    if (mss_auth_is_secure_request()) {
        $options['secure'] = true;
    }

    setcookie($name, $value, $options);
    $_COOKIE[$name] = $value;
}

function mss_auth_read_session_token(): string
{
    $sessionToken = trim((string) ($_SESSION['mss_auth_token'] ?? ''));
    if ($sessionToken !== '') {
        return $sessionToken;
    }

    return trim((string) ($_COOKIE[mss_auth_token_cookie_name()] ?? ''));
}

function mss_auth_assign_session_token(string $token = ''): string
{
    $resolvedToken = trim($token) !== '' ? trim($token) : mss_auth_uid('msssess');
    $_SESSION['mss_auth_token'] = $resolvedToken;
    mss_auth_set_cookie(mss_auth_token_cookie_name(), $resolvedToken);

    return $resolvedToken;
}

function mss_auth_resolve_session_token(bool $rotate = false): string
{
    if ($rotate) {
        return mss_auth_assign_session_token(mss_auth_uid('msssess'));
    }

    $existingToken = mss_auth_read_session_token();
    return mss_auth_assign_session_token($existingToken);
}

function mss_auth_clear_session_token(): void
{
    unset($_SESSION['mss_auth_token']);
    mss_auth_set_cookie(mss_auth_token_cookie_name(), '', time() - 42000);
}

function mss_auth_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name(mss_auth_session_name());
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
    ]);
}

function mss_auth_bootstrap(): PDO
{
    mss_auth_start_session();
    $pdo = mss_db_connection();
    mss_auth_seed_initial_admin($pdo);

    return $pdo;
}

function mss_auth_seed_initial_admin(PDO $pdo): void
{
    static $legacyCleanupDone = false;
    if ($legacyCleanupDone) {
        return;
    }

    $legacyCleanupDone = true;

    $rows = $pdo->query(
        'SELECT `id`, `username`, `role`, `account_type`, `created_by`, `credentials_updated_at`
         FROM `mss_users`
         ORDER BY `username` ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows) || $rows === []) {
        return;
    }

    $legacyUsers = [
        'mss_admin_1' => ['username' => 'nurse.incharge', 'role' => 'admin'],
        'mss_staff_1' => ['username' => 'staff.user', 'role' => 'staff'],
    ];

    foreach ($rows as $row) {
        $id = trim((string) ($row['id'] ?? ''));
        $username = trim((string) ($row['username'] ?? ''));
        $createdBy = trim((string) ($row['created_by'] ?? ''));
        $credentialsUpdatedAt = trim((string) ($row['credentials_updated_at'] ?? ''));
        $normalizedRole = mss_auth_normalize_role((string) ($row['role'] ?? $row['account_type'] ?? ''));

        if (
            !isset($legacyUsers[$id])
            || strcasecmp($username, (string) $legacyUsers[$id]['username']) !== 0
            || $normalizedRole !== $legacyUsers[$id]['role']
            || $createdBy !== 'System Seed'
            || $credentialsUpdatedAt !== ''
        ) {
            return;
        }
    }

    $legacyIds = array_map(
        static fn (array $row): string => trim((string) ($row['id'] ?? '')),
        $rows
    );
    $legacyIds = array_values(array_filter(array_unique($legacyIds)));
    if ($legacyIds === []) {
        return;
    }

    $deleteSessions = $pdo->prepare('DELETE FROM `mss_sessions` WHERE `user_id` = :user_id');
    $deleteUsers = $pdo->prepare('DELETE FROM `mss_users` WHERE `id` = :id');
    foreach ($legacyIds as $legacyId) {
        $deleteSessions->execute([':user_id' => $legacyId]);
        $deleteUsers->execute([':id' => $legacyId]);
    }
}

function mss_auth_normalize_role(string $value): string
{
    return match (strtolower(trim($value))) {
        'admin',
        'administrator',
        'nurse-in-charge',
        'nurse in charge' => 'admin',
        'staff',
        'bhw',
        'barangay health worker',
        'barangay-health-worker' => 'staff',
        default => '',
    };
}

function mss_auth_location_from_script(string $scriptName): string
{
    return match (strtolower(trim($scriptName))) {
        'index.php' => 'Admin Dashboard',
        'settings.php' => 'Settings Module',
        'staff.php' => 'Staff Dashboard',
        'medicine-inventory.php' => 'Medicine Inventory',
        'cho-request-log.php' => 'CHO Request Log',
        'dispensing-records.php',
        'resident-medication-records.php' => 'Dispensing Records',
        'reports.php' => 'Reports',
        'notifications.php' => 'Notifications',
        default => '',
    };
}

function mss_auth_request_location_label(string $override = ''): string
{
    $override = trim($override);
    if ($override !== '') {
        return $override;
    }

    $scriptName = strtolower(basename((string) ($_SERVER['SCRIPT_NAME'] ?? '')));
    if (in_array($scriptName, ['auth-api.php', 'state-api.php'], true)) {
        $referrerPath = trim((string) parse_url((string) ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_PATH));
        $referrerScript = strtolower(basename($referrerPath));
        $referrerLocation = mss_auth_location_from_script($referrerScript);
        if ($referrerLocation !== '') {
            return $referrerLocation;
        }
    }

    $location = mss_auth_location_from_script($scriptName);
    return $location !== '' ? $location : 'Medicine Stock Module';
}

function mss_auth_setup_required(PDO $pdo): bool
{
    $rows = $pdo->query('SELECT `role`, `account_type` FROM `mss_users`')->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($rows) || $rows === []) {
        return true;
    }

    foreach ($rows as $row) {
        $normalizedRole = mss_auth_normalize_role((string) ($row['role'] ?? $row['account_type'] ?? ''));
        if ($normalizedRole === 'admin') {
            return false;
        }
    }

    return true;
}

function mss_auth_uid(string $prefix): string
{
    try {
        return $prefix . '_' . bin2hex(random_bytes(8));
    } catch (Throwable $exception) {
        return $prefix . '_' . uniqid('', true);
    }
}

function mss_auth_insert_activity_log(PDO $pdo, array $entry): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO `mss_activity_logs`
            (`id`, `actor`, `username`, `action`, `action_type`, `target`, `details`, `category`, `result_label`, `result_tone`, `ip_address`, `created_at`)
         VALUES
            (:id, :actor, :username, :action, :action_type, :target, :details, :category, :result_label, :result_tone, :ip_address, :created_at)'
    );
    $stmt->execute([
        ':id' => trim((string) ($entry['id'] ?? '')) ?: mss_auth_uid('log'),
        ':actor' => trim((string) ($entry['actor'] ?? '')),
        ':username' => trim((string) ($entry['username'] ?? '')),
        ':action' => trim((string) ($entry['action'] ?? '')),
        ':action_type' => trim((string) ($entry['action_type'] ?? '')) ?: 'updated',
        ':target' => trim((string) ($entry['target'] ?? '')),
        ':details' => trim((string) ($entry['details'] ?? '')),
        ':category' => trim((string) ($entry['category'] ?? '')) ?: 'General',
        ':result_label' => trim((string) ($entry['result_label'] ?? '')) ?: 'Success',
        ':result_tone' => trim((string) ($entry['result_tone'] ?? '')) ?: 'success',
        ':ip_address' => trim((string) ($entry['ip_address'] ?? '')),
        ':created_at' => trim((string) ($entry['created_at'] ?? '')) ?: mss_auth_now(),
    ]);
}

function mss_auth_record_login_attempt(PDO $pdo, bool $success, string $username, string $details, ?array $user = null, string $ipAddress = ''): void
{
    try {
        $matchedFullName = trim((string) ($user['full_name'] ?? ''));
        $matchedUsername = trim((string) ($user['username'] ?? ''));
        $actor = $matchedFullName !== ''
            ? $matchedFullName
            : ($matchedUsername !== '' ? $matchedUsername : trim($username));
        $target = $matchedUsername !== '' ? $matchedUsername : trim($username);

        mss_auth_insert_activity_log($pdo, [
            'actor' => $actor !== '' ? $actor : 'Unknown User',
            'username' => trim($username),
            'action' => $success ? 'Login successful.' : 'Failed login attempt',
            'action_type' => $success ? 'access' : 'security',
            'target' => $target !== '' ? $target : 'Authentication',
            'details' => trim($details),
            'category' => $success ? 'Access' : 'Security',
            'result_label' => $success ? 'Success' : 'Failed',
            'result_tone' => $success ? 'success' : 'danger',
            'ip_address' => trim($ipAddress),
            'created_at' => mss_auth_now(),
        ]);
    } catch (Throwable $exception) {
        // Authentication must continue even if security logging fails.
    }
}

/**
 * @return array<string, mixed>
 */
function mss_auth_create_initial_admin(PDO $pdo, string $username, string $password): array
{
    if (!mss_auth_setup_required($pdo)) {
        throw new RuntimeException('The admin account has already been configured.');
    }

    $username = trim($username);
    $password = (string) $password;

    if ($username === '' || strlen($username) < 4) {
        throw new InvalidArgumentException('Username must be at least 4 characters.');
    }
    if (preg_match('/^[A-Za-z0-9._-]+$/', $username) !== 1) {
        throw new InvalidArgumentException('Username may only contain letters, numbers, dots, underscores, and hyphens.');
    }
    if (strlen($password) < 8) {
        throw new InvalidArgumentException('Password must be at least 8 characters.');
    }
    if (is_array(mss_auth_find_user_by_username($pdo, $username))) {
        throw new InvalidArgumentException('That username is already in use.');
    }

    $timestamp = mss_auth_now();
    $id = mss_auth_uid('mss_admin');

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_users`
            (`id`, `full_name`, `username`, `contact`, `account_type`, `role`, `status`, `password_hash`, `credentials_updated_at`, `created_at`, `created_by`, `updated_at`, `updated_by`)
         VALUES
            (:id, :full_name, :username, :contact, :account_type, :role, :status, :password_hash, :credentials_updated_at, :created_at, :created_by, :updated_at, :updated_by)'
    );
    $stmt->execute([
        ':id' => $id,
        ':full_name' => 'Nurse-in-Charge',
        ':username' => $username,
        ':contact' => '',
        ':account_type' => 'Admin',
        ':role' => 'Admin',
        ':status' => 'Active',
        ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ':credentials_updated_at' => $timestamp,
        ':created_at' => $timestamp,
        ':created_by' => 'Initial Setup',
        ':updated_at' => $timestamp,
        ':updated_by' => 'Initial Setup',
    ]);

    $user = mss_auth_find_user_by_id($pdo, $id);
    if (!is_array($user)) {
        throw new RuntimeException('Unable to finish admin setup right now.');
    }

    return $user;
}

/**
 * @return array<string, mixed>|null
 */
function mss_auth_find_user_by_username(PDO $pdo, string $username): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM `mss_users` WHERE `username` = :username LIMIT 1');
    $stmt->execute([':username' => trim($username)]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($user) ? $user : null;
}

/**
 * @return array<string, mixed>|null
 */
function mss_auth_find_user_by_username_exact(PDO $pdo, string $username): ?array
{
    // The table collation is case-insensitive, so login must force an exact match.
    $stmt = $pdo->prepare('SELECT * FROM `mss_users` WHERE BINARY `username` = BINARY :username LIMIT 1');
    $stmt->execute([':username' => trim($username)]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($user) ? $user : null;
}

/**
 * @return array<string, mixed>|null
 */
function mss_auth_find_user_by_id(PDO $pdo, string $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM `mss_users` WHERE `id` = :id LIMIT 1');
    $stmt->execute([':id' => trim($userId)]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($user) ? $user : null;
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function mss_auth_user_payload(array $user): array
{
    return [
        'id' => (string) ($user['id'] ?? ''),
        'fullName' => (string) ($user['full_name'] ?? ''),
        'username' => (string) ($user['username'] ?? ''),
        'contact' => (string) ($user['contact'] ?? ''),
        'accountType' => (string) ($user['account_type'] ?? ''),
        'role' => (string) ($user['role'] ?? ''),
        'status' => (string) ($user['status'] ?? ''),
        'normalizedRole' => mss_auth_user_role($user),
        'homePath' => mss_auth_user_home($user),
        'requiresCredentialUpdate' => mss_auth_user_requires_credential_update($user),
        'credentialsUpdatedAt' => (string) ($user['credentials_updated_at'] ?? ''),
        'createdAt' => (string) ($user['created_at'] ?? ''),
        'createdBy' => (string) ($user['created_by'] ?? ''),
        'updatedAt' => (string) ($user['updated_at'] ?? ''),
        'updatedBy' => (string) ($user['updated_by'] ?? ''),
    ];
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_user_role(array $user): string
{
    $normalizedRole = mss_auth_normalize_role((string) ($user['role'] ?? ''));
    if ($normalizedRole !== '') {
        return $normalizedRole;
    }

    $accountType = (string) ($user['account_type'] ?? $user['accountType'] ?? '');
    return mss_auth_normalize_role($accountType);
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_user_requires_credential_update(array $user): bool
{
    return mss_auth_user_role($user) === 'staff'
        && trim((string) ($user['credentials_updated_at'] ?? $user['credentialsUpdatedAt'] ?? '')) === '';
}

function mss_auth_clear_session_state(): void
{
    unset(
        $_SESSION['mss_user_id'],
        $_SESSION['mss_signed_in_at'],
        $_SESSION['mss_recent_password_verification_user_id'],
        $_SESSION['mss_recent_password_verification_at']
    );
    mss_auth_clear_session_token();
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_mark_session_authenticated(array $user, string $signedInAt = ''): void
{
    $_SESSION['mss_user_id'] = (string) ($user['id'] ?? '');
    $_SESSION['mss_signed_in_at'] = mss_auth_resolve_session_started_at($user, $signedInAt);
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_resolve_session_started_at(array $user, string $fallback = ''): string
{
    $resolvedStartedAt = trim($fallback);
    $resolvedTimestamp = $resolvedStartedAt !== '' ? strtotime($resolvedStartedAt) : false;
    $credentialsUpdatedAt = trim((string) ($user['credentials_updated_at'] ?? $user['credentialsUpdatedAt'] ?? ''));
    $credentialsTimestamp = $credentialsUpdatedAt !== '' ? strtotime($credentialsUpdatedAt) : false;

    if ($credentialsTimestamp !== false && ($resolvedTimestamp === false || $credentialsTimestamp > $resolvedTimestamp)) {
        return date('Y-m-d H:i:s', $credentialsTimestamp);
    }

    if ($resolvedTimestamp !== false) {
        return date('Y-m-d H:i:s', $resolvedTimestamp);
    }

    return mss_auth_now();
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_mark_recent_password_verification(PDO $pdo, array $user): void
{
    $userId = trim((string) ($user['id'] ?? ''));
    if ($userId === '') {
        return;
    }

    $verifiedAt = mss_auth_now();
    $_SESSION['mss_recent_password_verification_user_id'] = $userId;
    $_SESSION['mss_recent_password_verification_at'] = $verifiedAt;

    mss_auth_touch_session($pdo, $user);
    $sessionToken = mss_auth_read_session_token();
    if ($sessionToken === '') {
        return;
    }

    $stmt = $pdo->prepare(
        'UPDATE `mss_sessions`
         SET `password_verified_at` = :verified_at,
             `updated_at` = :updated_at
         WHERE `session_token` = :token
           AND `user_id` = :user_id'
    );
    $stmt->execute([
        ':verified_at' => $verifiedAt,
        ':updated_at' => $verifiedAt,
        ':token' => $sessionToken,
        ':user_id' => $userId,
    ]);
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_has_recent_password_verification(PDO $pdo, array $user): bool
{
    $userId = trim((string) ($user['id'] ?? ''));
    $verifiedUserId = trim((string) ($_SESSION['mss_recent_password_verification_user_id'] ?? ''));
    if ($userId !== '' && $verifiedUserId !== '' && $userId === $verifiedUserId) {
        $verifiedAt = trim((string) ($_SESSION['mss_recent_password_verification_at'] ?? ''));
        if (mss_auth_recent_password_verification_is_valid($verifiedAt)) {
            return true;
        }
    }

    if ($userId === '') {
        return false;
    }

    $sessionToken = mss_auth_read_session_token();
    if ($sessionToken === '') {
        return false;
    }

    $session = mss_auth_find_session_by_token($pdo, $sessionToken);
    if (!is_array($session) || trim((string) ($session['user_id'] ?? '')) !== $userId) {
        return false;
    }

    return mss_auth_recent_password_verification_is_valid((string) ($session['password_verified_at'] ?? ''));
}

function mss_auth_recent_password_verification_is_valid(string $verifiedAt): bool
{
    $verifiedAt = trim($verifiedAt);
    if ($verifiedAt === '') {
        return false;
    }

    $verifiedTimestamp = strtotime($verifiedAt);
    if ($verifiedTimestamp === false) {
        return false;
    }

    return $verifiedTimestamp >= (time() - 600);
}

function mss_auth_clear_recent_password_verification(PDO $pdo): void
{
    unset(
        $_SESSION['mss_recent_password_verification_user_id'],
        $_SESSION['mss_recent_password_verification_at']
    );

    $sessionToken = mss_auth_read_session_token();
    if ($sessionToken === '') {
        return;
    }

    $stmt = $pdo->prepare(
        'UPDATE `mss_sessions`
         SET `password_verified_at` = NULL
         WHERE `session_token` = :token'
    );
    $stmt->execute([':token' => $sessionToken]);
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_credentials_changed_after_timestamp(array $user, string $sessionStartedAt): bool
{
    $credentialsUpdatedAt = trim((string) ($user['credentials_updated_at'] ?? ''));
    if ($credentialsUpdatedAt === '') {
        return false;
    }

    $credentialsUpdatedTimestamp = strtotime($credentialsUpdatedAt);
    if ($credentialsUpdatedTimestamp === false) {
        return false;
    }

    $sessionStartedAt = trim($sessionStartedAt);
    if ($sessionStartedAt === '') {
        return false;
    }

    $sessionStartedTimestamp = strtotime($sessionStartedAt);
    if ($sessionStartedTimestamp === false) {
        return false;
    }

    return $credentialsUpdatedTimestamp > $sessionStartedTimestamp;
}

/**
 * @param array<string, mixed> $user
 */
function mss_auth_user_home(array $user): string
{
    return match (mss_auth_user_role($user)) {
        'staff' => 'staff.php',
        'admin' => 'index.php',
        default => 'index.php',
    };
}

/**
 * @return array<string, mixed>|null
 */
function mss_auth_current_user(PDO $pdo): ?array
{
    $userId = trim((string) ($_SESSION['mss_user_id'] ?? ''));
    $sessionToken = mss_auth_read_session_token();
    $session = $sessionToken !== '' ? mss_auth_find_session_by_token($pdo, $sessionToken) : null;
    if ($userId === '' && is_array($session)) {
        $userId = trim((string) ($session['user_id'] ?? ''));
    }
    if ($userId === '') {
        return null;
    }

    $user = mss_auth_find_user_by_id($pdo, $userId);
    if (!is_array($user) || trim((string) ($user['status'] ?? '')) !== 'Active') {
        mss_auth_clear_session_state();
        return null;
    }

    if (!is_array($session)) {
        $sessionStartedAt = trim((string) ($_SESSION['mss_signed_in_at'] ?? ''));
        if (mss_auth_credentials_changed_after_timestamp($user, $sessionStartedAt)) {
            if (!mss_auth_has_recent_password_verification($pdo, $user)) {
                mss_auth_clear_session_state();
                return null;
            }
            mss_auth_mark_session_authenticated($user, $user['credentials_updated_at'] ?? mss_auth_now());
            mss_auth_touch_session($pdo, $user);
            mss_auth_clear_recent_password_verification($pdo);
            return $user;
        }
        if ($sessionStartedAt !== '') {
            mss_auth_mark_session_authenticated($user, $sessionStartedAt);
            mss_auth_touch_session($pdo, $user);
            return $user;
        }
        mss_auth_clear_session_state();
        return null;
    }

    $sessionStartedAt = trim((string) ($session['signed_in_at'] ?? $session['created_at'] ?? $session['updated_at'] ?? ''));
    mss_auth_mark_session_authenticated($user, $sessionStartedAt);
    mss_auth_assign_session_token($sessionToken);
    if (mss_auth_credentials_changed_after_session($user, $session)) {
        if (!mss_auth_has_recent_password_verification($pdo, $user)) {
            mss_auth_clear_session_state();
            $stmt = $pdo->prepare('DELETE FROM `mss_sessions` WHERE `session_token` = :token');
            $stmt->execute([':token' => $sessionToken]);
            return null;
        }
        mss_auth_mark_session_authenticated($user, $user['credentials_updated_at'] ?? mss_auth_now());
        mss_auth_touch_session($pdo, $user);
        mss_auth_clear_recent_password_verification($pdo);
        return $user;
    }

    return $user;
}

/**
 * @return array<string, mixed>|null
 */
function mss_auth_find_session_by_token(PDO $pdo, string $token): ?array
{
    $token = trim($token);
    if ($token === '') {
        return null;
    }

    $stmt = $pdo->prepare('SELECT * FROM `mss_sessions` WHERE `session_token` = :token LIMIT 1');
    $stmt->execute([':token' => $token]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($session) ? $session : null;
}

/**
 * @param array<string, mixed>|null $session
 */
function mss_auth_credentials_changed_after_session(array $user, ?array $session): bool
{
    if (!is_array($session)) {
        return false;
    }
    $sessionStartedAt = trim((string) ($session['signed_in_at'] ?? $session['created_at'] ?? $session['updated_at'] ?? ''));
    return mss_auth_credentials_changed_after_timestamp($user, $sessionStartedAt);
}

/**
 * @return array<string, mixed>
 */
function mss_auth_require_user(PDO $pdo): array
{
    $user = mss_auth_current_user($pdo);
    if (!is_array($user)) {
        throw new RuntimeException('Authentication required.');
    }

    return $user;
}

function mss_auth_touch_session(PDO $pdo, array $user, string $ipAddress = '', string $locationLabel = '', string $deviceLabel = ''): void
{
    $token = mss_auth_resolve_session_token();
    if ($token === '') {
        return;
    }

    $now = mss_auth_now();
    $signedInAt = trim((string) ($_SESSION['mss_signed_in_at'] ?? ''));
    if ($signedInAt === '') {
        $signedInAt = $now;
        $_SESSION['mss_signed_in_at'] = $signedInAt;
    }
    $resolvedLocationLabel = mss_auth_request_location_label($locationLabel);
    $resolvedDeviceLabel = trim($deviceLabel) !== '' ? trim($deviceLabel) : 'Web Browser';
    $stmt = $pdo->prepare(
        'INSERT INTO `mss_sessions`
            (`session_token`, `user_id`, `full_name`, `username`, `role`, `account_type`, `presence`, `location_label`, `device_label`, `ip_address`, `signed_in_at`, `last_seen_at`, `created_at`, `updated_at`)
         VALUES
            (:session_token, :user_id, :full_name, :username, :role, :account_type, :presence, :location_label, :device_label, :ip_address, :signed_in_at, :last_seen_at, :created_at, :updated_at)
         ON DUPLICATE KEY UPDATE
            `user_id` = VALUES(`user_id`),
            `full_name` = VALUES(`full_name`),
            `username` = VALUES(`username`),
            `role` = VALUES(`role`),
            `account_type` = VALUES(`account_type`),
            `presence` = VALUES(`presence`),
            `location_label` = VALUES(`location_label`),
            `device_label` = VALUES(`device_label`),
            `ip_address` = VALUES(`ip_address`),
            `signed_in_at` = VALUES(`signed_in_at`),
            `last_seen_at` = VALUES(`last_seen_at`),
            `updated_at` = VALUES(`updated_at`)'
    );
    $stmt->execute([
        ':session_token' => $token,
        ':user_id' => (string) ($user['id'] ?? ''),
        ':full_name' => (string) ($user['full_name'] ?? ''),
        ':username' => (string) ($user['username'] ?? ''),
        ':role' => (string) ($user['role'] ?? ''),
        ':account_type' => (string) ($user['account_type'] ?? ''),
        ':presence' => 'Online',
        ':location_label' => $resolvedLocationLabel,
        ':device_label' => $resolvedDeviceLabel,
        ':ip_address' => $ipAddress,
        ':signed_in_at' => $signedInAt,
        ':last_seen_at' => $now,
        ':created_at' => $signedInAt,
        ':updated_at' => $now,
    ]);
}

function mss_auth_refresh_current_session(PDO $pdo, array $user, string $ipAddress = '', string $locationLabel = '', string $deviceLabel = '', bool $rotate = false): void
{
    $previousToken = mss_auth_read_session_token();

    if ($rotate) {
        session_regenerate_id(true);
        mss_auth_assign_session_token(mss_auth_uid('msssess'));
        if ($previousToken !== '') {
            $deleteSession = $pdo->prepare('DELETE FROM `mss_sessions` WHERE `session_token` = :token');
            $deleteSession->execute([':token' => $previousToken]);
        }
    } else {
        mss_auth_resolve_session_token();
    }

    $sessionStartedAt = trim((string) ($_SESSION['mss_signed_in_at'] ?? ''));
    if ($rotate || $sessionStartedAt === '') {
        $sessionStartedAt = mss_auth_now();
    }
    mss_auth_mark_session_authenticated($user, $sessionStartedAt);
    mss_auth_touch_session($pdo, $user, $ipAddress, $locationLabel, $deviceLabel);
    mss_auth_clear_recent_password_verification($pdo);
}

/**
 * @return array<string, mixed>
 */
function mss_auth_attempt_login(PDO $pdo, string $username, string $password, string $ipAddress = ''): array
{
    $username = trim($username);
    $password = (string) $password;

    if ($username === '' || $password === '') {
        mss_auth_record_login_attempt($pdo, false, $username, 'Login failed: missing username or password.', null, $ipAddress);
        throw new InvalidArgumentException('Please enter username and password.');
    }

    $user = mss_auth_find_user_by_username_exact($pdo, $username);
    if (!is_array($user)) {
        $user = mss_auth_find_user_by_username($pdo, $username);
    }
    if (!is_array($user)) {
        mss_auth_record_login_attempt($pdo, false, $username, 'Login failed: username not found.', null, $ipAddress);
        throw new RuntimeException('Invalid username or password.');
    }

    if (!password_verify($password, (string) ($user['password_hash'] ?? ''))) {
        mss_auth_record_login_attempt($pdo, false, $username, 'Login failed: invalid password.', $user, $ipAddress);
        throw new RuntimeException('Invalid username or password.');
    }

    if (trim((string) ($user['status'] ?? '')) !== 'Active') {
        mss_auth_record_login_attempt($pdo, false, $username, 'Login failed: account is disabled.', $user, $ipAddress);
        throw new RuntimeException('This account is inactive.');
    }

    mss_auth_refresh_current_session($pdo, $user, $ipAddress, '', '', true);
    mss_auth_record_login_attempt($pdo, true, $username, 'Login successful.', $user, $ipAddress);

    return mss_auth_user_payload($user);
}

function mss_auth_logout(PDO $pdo): void
{
    $token = mss_auth_read_session_token();
    if ($token !== '') {
        $stmt = $pdo->prepare('DELETE FROM `mss_sessions` WHERE `session_token` = :token');
        $stmt->execute([':token' => $token]);
    }

    $_SESSION = [];
    mss_auth_clear_session_token();
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'] ?? '/', $params['domain'] ?? '', (bool) ($params['secure'] ?? false), (bool) ($params['httponly'] ?? true));
    }
    session_destroy();
}

/**
 * @return array<string, mixed>|null
 */
function mss_page_current_user(): ?array
{
    static $user = null;
    static $resolved = false;

    if ($resolved) {
        return $user;
    }

    $resolved = true;
    $pdo = mss_auth_bootstrap();
    $user = mss_auth_current_user($pdo);

    return $user;
}

function mss_page_client_ip(): string
{
    foreach (['HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        $value = trim((string) ($_SERVER[$key] ?? ''));
        if ($value !== '') {
            return $value;
        }
    }

    return '127.0.0.1';
}

function mss_page_redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}

/**
 * @return array<string, mixed>
 */
function mss_page_require_auth(array $allowedRoles = []): array
{
    $pdo = mss_auth_bootstrap();
    $user = mss_page_current_user();
    if (!is_array($user)) {
        mss_page_redirect('login.php');
    }

    mss_auth_touch_session($pdo, $user, mss_page_client_ip());

    $resolvedAllowedRoles = array_values(array_filter(array_unique(array_map(
        static fn (string $role): string => mss_auth_normalize_role($role),
        $allowedRoles
    ))));
    if ($resolvedAllowedRoles !== [] && !in_array(mss_auth_user_role($user), $resolvedAllowedRoles, true)) {
        mss_page_redirect(mss_auth_user_home($user));
    }

    if (mss_auth_user_requires_credential_update($user)) {
        $scriptName = strtolower(basename((string) ($_SERVER['SCRIPT_NAME'] ?? '')));
        if ($scriptName !== 'staff.php') {
            mss_page_redirect('staff.php#my-settings');
        }
    }

    return $user;
}

function mss_page_redirect_if_authenticated(?string $path = null): void
{
    $pdo = mss_auth_bootstrap();
    $user = mss_page_current_user();
    if (!is_array($user)) {
        return;
    }

    mss_auth_touch_session($pdo, $user, mss_page_client_ip());
    $targetPath = is_string($path) && trim($path) !== '' ? $path : mss_auth_user_home($user);
    mss_page_redirect($targetPath);
}

function mss_api_respond(array $payload, int $statusCode = 200): never
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mss_api_error(string $message, int $statusCode = 400, array $extra = []): never
{
    mss_api_respond(array_merge([
        'success' => false,
        'message' => $message,
    ], $extra), $statusCode);
}

/**
 * @return array<string, mixed>
 */
function mss_api_json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function mss_api_request_method(): string
{
    return strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function mss_api_client_ip(): string
{
    foreach (['HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        $value = trim((string) ($_SERVER[$key] ?? ''));
        if ($value !== '') {
            return $value;
        }
    }

    return '127.0.0.1';
}

function mss_api_bootstrap(bool $requireAuth = true): PDO
{
    try {
        $pdo = mss_auth_bootstrap();
    } catch (Throwable $exception) {
        mss_api_error('Unable to initialize backend.', 500);
    }

    if ($requireAuth) {
        try {
            $user = mss_auth_require_user($pdo);
            mss_auth_touch_session($pdo, $user, mss_api_client_ip());
        } catch (Throwable $exception) {
            mss_api_error('Authentication required.', 401);
        }
    }

    return $pdo;
}
