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

const USERS_API_BACKUP_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const USERS_API_BACKUP_MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

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
 * @return array<string, mixed>
 */
function users_api_read_request_payload(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (
        strpos($contentType, 'multipart/form-data') !== false
        || strpos($contentType, 'application/x-www-form-urlencoded') !== false
    ) {
        return is_array($_POST) ? $_POST : [];
    }
    return users_api_read_json_body();
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
        'SELECT `id`, `full_name`, `username`, `role`, `contact_number`, `is_active`, `must_change_password`, `created_at`, `updated_at`, `last_seen_at`
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
        $lastSeenAt = (string) ($row['last_seen_at'] ?? '');
        $payload['lastSeenAt'] = $lastSeenAt;
        $payload['presence'] = auth_presence_is_online($lastSeenAt) ? 'online' : 'offline';
        $accounts[] = $payload;
    }

    usort($accounts, static function (array $a, array $b): int {
        $aOnline = (($a['presence'] ?? '') === 'online') ? 1 : 0;
        $bOnline = (($b['presence'] ?? '') === 'online') ? 1 : 0;
        if ($aOnline !== $bOnline) {
            return $bOnline <=> $aOnline;
        }
        return strcmp(
            strtolower((string) ($a['fullName'] ?? '')),
            strtolower((string) ($b['fullName'] ?? ''))
        );
    });

    return $accounts;
}

function users_api_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM `information_schema`.`COLUMNS`
         WHERE `TABLE_SCHEMA` = DATABASE()
           AND `TABLE_NAME` = :table_name
           AND `COLUMN_NAME` = :column_name
         LIMIT 1'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function users_api_ensure_barangay_profile_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `barangay_profile` (
            `id` TINYINT UNSIGNED NOT NULL,
            `region_name` VARCHAR(120) NULL,
            `province_name` VARCHAR(120) NULL,
            `city_name` VARCHAR(120) NULL,
            `barangay_name` VARCHAR(160) NULL,
            `barangay_code` VARCHAR(80) NULL,
            `captain_name` VARCHAR(160) NULL,
            `secretary_name` VARCHAR(160) NULL,
            `official_seal_path` VARCHAR(255) NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $requiredColumns = [
        'region_name' => 'VARCHAR(120) NULL',
        'province_name' => 'VARCHAR(120) NULL',
        'city_name' => 'VARCHAR(120) NULL',
        'barangay_name' => 'VARCHAR(160) NULL',
        'barangay_code' => 'VARCHAR(80) NULL',
        'captain_name' => 'VARCHAR(160) NULL',
        'secretary_name' => 'VARCHAR(160) NULL',
        'official_seal_path' => 'VARCHAR(255) NULL',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];

    foreach ($requiredColumns as $columnName => $definition) {
        if (users_api_column_exists($pdo, 'barangay_profile', $columnName)) {
            continue;
        }
        $pdo->exec('ALTER TABLE `barangay_profile` ADD COLUMN `' . $columnName . '` ' . $definition);
    }

    foreach (['email', 'contact_number', 'hall_address'] as $legacyColumn) {
        if (!users_api_column_exists($pdo, 'barangay_profile', $legacyColumn)) {
            continue;
        }
        $pdo->exec('ALTER TABLE `barangay_profile` DROP COLUMN `' . $legacyColumn . '`');
    }
}

/**
 * @return array<string, string>
 */
function users_api_barangay_profile_defaults(): array
{
    return [
        'region_name' => '',
        'province_name' => '',
        'city_name' => '',
        'barangay_name' => '',
        'barangay_code' => '',
        'captain_name' => '',
        'secretary_name' => '',
        'official_seal_path' => '',
    ];
}

/**
 * @return string
 */
function users_api_official_seal_extension_from_mime(string $mime): string
{
    return match (strtolower(trim($mime))) {
        'image/png', 'image/x-png' => 'png',
        'image/jpeg', 'image/jpg', 'image/pjpeg' => 'jpg',
        'image/webp', 'image/x-webp' => 'webp',
        default => '',
    };
}

/**
 * @return array{mime:string,extension:string,binary:string}|null
 */
function users_api_decode_official_seal_data(mixed $value): ?array
{
    if (!is_string($value)) {
        return null;
    }

    $raw = trim($value);
    if ($raw === '') {
        return null;
    }
    if (strlen($raw) > 8 * 1024 * 1024) {
        users_api_error(413, 'Official seal payload is too large.');
    }

    if (preg_match('/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=\r\n]+)$/', $raw, $matches) !== 1) {
        users_api_error(422, 'Official seal must be a PNG, JPG, or WEBP image.');
    }

    $mime = strtolower((string) ($matches[1] ?? ''));
    $encoded = preg_replace('/\s+/', '', (string) ($matches[2] ?? ''));
    if ($encoded === null || $encoded === '') {
        users_api_error(422, 'Official seal image data is invalid.');
    }

    $binary = base64_decode($encoded, true);
    if (!is_string($binary) || $binary === '') {
        users_api_error(422, 'Official seal image data is invalid.');
    }
    if (strlen($binary) > 2 * 1024 * 1024) {
        users_api_error(413, 'Official seal image must be 2MB or less.');
    }

    $extension = users_api_official_seal_extension_from_mime($mime);
    if ($extension === '') {
        users_api_error(422, 'Official seal must be a PNG, JPG, or WEBP image.');
    }

    return [
        'mime' => $mime,
        'extension' => $extension,
        'binary' => $binary,
    ];
}

function users_api_delete_official_seal_file(string $relativePath): void
{
    $normalized = ltrim(trim(str_replace('\\', '/', $relativePath)), '/');
    if ($normalized === '') {
        return;
    }

    $prefix = 'assets/img/official-seals/';
    if (strpos($normalized, $prefix) !== 0) {
        return;
    }

    $fileName = basename($normalized);
    if ($fileName === '' || $fileName === '.' || $fileName === '..') {
        return;
    }

    $absolutePath = __DIR__ . '/assets/img/official-seals/' . $fileName;
    if (is_file($absolutePath)) {
        @unlink($absolutePath);
    }
}

/**
 * @return array{mime:string,extension:string,binary:string}|null
 */
function users_api_uploaded_official_seal(): ?array
{
    $file = $_FILES['official_seal_file'] ?? null;
    if (!is_array($file)) {
        return null;
    }

    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($error !== UPLOAD_ERR_OK) {
        users_api_error(422, 'Failed to upload official seal image.');
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_file($tmpPath)) {
        users_api_error(422, 'Uploaded official seal file is invalid.');
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0) {
        users_api_error(422, 'Uploaded official seal file is empty.');
    }
    if ($size > 2 * 1024 * 1024) {
        users_api_error(413, 'Official seal image must be 2MB or less.');
    }

    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $detected = finfo_file($finfo, $tmpPath);
            finfo_close($finfo);
            if (is_string($detected)) {
                $mime = strtolower(trim($detected));
            }
        }
    }
    if ($mime === '') {
        $mime = strtolower((string) ($file['type'] ?? ''));
    }

    $clientMime = strtolower((string) ($file['type'] ?? ''));
    $extension = users_api_official_seal_extension_from_mime($mime);
    if ($extension === '' && $clientMime !== '') {
        $extension = users_api_official_seal_extension_from_mime($clientMime);
        if ($extension !== '') {
            $mime = $clientMime;
        }
    }
    if ($extension === '') {
        users_api_error(422, 'Official seal must be a PNG, JPG, or WEBP image.');
    }

    $binary = file_get_contents($tmpPath);
    if (!is_string($binary) || $binary === '') {
        users_api_error(422, 'Uploaded official seal file is invalid.');
    }

    return [
        'mime' => $mime,
        'extension' => $extension,
        'binary' => $binary,
    ];
}

/**
 * @return array<string, string>
 */
function users_api_barangay_profile(PDO $pdo): array
{
    $profile = users_api_barangay_profile_defaults();

    try {
        users_api_ensure_barangay_profile_table($pdo);
        $stmt = $pdo->prepare(
            'SELECT
                `region_name`,
                `province_name`,
                `city_name`,
                `barangay_name`,
                `barangay_code`,
                `captain_name`,
                `secretary_name`,
                `official_seal_path`
             FROM `barangay_profile`
             WHERE `id` = 1
             LIMIT 1'
        );
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (is_array($row)) {
            foreach ($profile as $key => $defaultValue) {
                $profile[$key] = users_api_text($row[$key] ?? '', 255);
            }
        }
    } catch (Throwable $exception) {
        // Keep defaults when table read fails.
    }

    return $profile;
}

function users_api_quote_identifier(string $value): string
{
    return '`' . str_replace('`', '``', $value) . '`';
}

function users_api_backup_relative_directory(): string
{
    return 'database/backups';
}

function users_api_backup_absolute_directory(): string
{
    return __DIR__ . '/database/backups';
}

function users_api_backup_human_size(int $bytes): string
{
    if ($bytes <= 0) {
        return 'N/A';
    }

    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $value = (float) $bytes;
    $unitIndex = 0;
    $maxUnitIndex = count($units) - 1;
    while ($value >= 1024 && $unitIndex < $maxUnitIndex) {
        $value /= 1024;
        $unitIndex++;
    }

    $precision = $unitIndex === 0 ? 0 : 2;
    $formatted = number_format($value, $precision, '.', '');
    $formatted = rtrim(rtrim($formatted, '0'), '.');
    return $formatted . ' ' . $units[$unitIndex];
}

function users_api_backup_normalized_file_name(mixed $value, bool $strictPattern = true): string
{
    $raw = trim((string) $value);
    if ($raw === '') {
        return '';
    }

    $raw = str_replace('\\', '/', $raw);
    $fileName = basename($raw);
    if ($fileName === '' || $fileName === '.' || $fileName === '..') {
        return '';
    }
    if (preg_match('/\.json$/i', $fileName) !== 1) {
        return '';
    }
    if ($strictPattern && preg_match('/^[A-Za-z0-9._-]+\.json$/', $fileName) !== 1) {
        return '';
    }
    return $fileName;
}

/**
 * @return array<int, array<string, mixed>>
 */
function users_api_backup_list_files(): array
{
    $directory = users_api_backup_absolute_directory();
    if (!is_dir($directory)) {
        return [];
    }

    $entries = @scandir($directory);
    if (!is_array($entries)) {
        return [];
    }

    $files = [];
    foreach ($entries as $entry) {
        $fileName = users_api_backup_normalized_file_name($entry);
        if ($fileName === '') {
            continue;
        }

        $absolutePath = $directory . '/' . $fileName;
        if (!is_file($absolutePath)) {
            continue;
        }

        $sizeValue = @filesize($absolutePath);
        $sizeBytes = is_int($sizeValue) && $sizeValue > 0 ? $sizeValue : 0;
        $modifiedValue = @filemtime($absolutePath);
        $modifiedAt = is_int($modifiedValue) && $modifiedValue > 0 ? $modifiedValue : 0;

        $files[] = [
            'file_name' => $fileName,
            'absolute_path' => $absolutePath,
            'relative_path' => users_api_backup_relative_directory() . '/' . $fileName,
            'size_bytes' => $sizeBytes,
            'size_label' => users_api_backup_human_size($sizeBytes),
            'created_at' => $modifiedAt > 0 ? gmdate('c', $modifiedAt) : '',
            'modified_at_unix' => $modifiedAt,
        ];
    }

    usort($files, static function (array $a, array $b): int {
        return (int) ($b['modified_at_unix'] ?? 0) <=> (int) ($a['modified_at_unix'] ?? 0);
    });

    return $files;
}

/**
 * @return array<string, mixed>|null
 */
function users_api_backup_latest_file(): ?array
{
    $files = users_api_backup_list_files();
    if ($files === []) {
        return null;
    }
    $first = $files[0] ?? null;
    return is_array($first) ? $first : null;
}

/**
 * @return array<string, mixed>|null
 */
function users_api_backup_find_file_by_name(string $fileName): ?array
{
    if ($fileName === '') {
        return null;
    }

    $normalized = users_api_backup_normalized_file_name($fileName);
    if ($normalized === '') {
        return null;
    }

    foreach (users_api_backup_list_files() as $file) {
        if ((string) ($file['file_name'] ?? '') === $normalized) {
            return $file;
        }
    }

    return null;
}

function users_api_backup_ensure_directory(): string
{
    $directory = users_api_backup_absolute_directory();
    if (!is_dir($directory)) {
        $created = @mkdir($directory, 0775, true);
        if ($created !== true && !is_dir($directory)) {
            users_api_error(500, 'Unable to create backup storage directory.');
        }
    }

    if (!is_writable($directory)) {
        users_api_error(500, 'Backup storage directory is not writable.');
    }

    return $directory;
}

/**
 * @return array<string, mixed>
 */
function users_api_backup_status_payload(): array
{
    $latest = users_api_backup_latest_file();
    if (!is_array($latest)) {
        return [
            'available' => false,
            'schedule' => 'Manual Only',
            'storage_location' => 'Local Server',
            'last_backup_at' => '',
            'last_backup_size_bytes' => 0,
            'last_backup_size_label' => 'N/A',
            'last_backup_file_name' => '',
        ];
    }

    return [
        'available' => true,
        'schedule' => 'Manual Only',
        'storage_location' => 'Local Server',
        'last_backup_at' => (string) ($latest['created_at'] ?? ''),
        'last_backup_size_bytes' => (int) ($latest['size_bytes'] ?? 0),
        'last_backup_size_label' => (string) ($latest['size_label'] ?? 'N/A'),
        'last_backup_file_name' => (string) ($latest['file_name'] ?? ''),
    ];
}

/**
 * @return array<int, string>
 */
function users_api_backup_table_names(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT `TABLE_NAME`
         FROM `information_schema`.`TABLES`
         WHERE `TABLE_SCHEMA` = DATABASE()
           AND `TABLE_TYPE` = "BASE TABLE"
         ORDER BY `TABLE_NAME` ASC'
    );
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    $tables = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $tableName = trim((string) ($row['TABLE_NAME'] ?? ''));
        if ($tableName === '' || preg_match('/^[A-Za-z0-9_]+$/', $tableName) !== 1) {
            continue;
        }
        $tables[] = $tableName;
    }
    return $tables;
}

/**
 * @return array<int, string>
 */
function users_api_backup_table_columns(PDO $pdo, string $tableName): array
{
    if ($tableName === '' || preg_match('/^[A-Za-z0-9_]+$/', $tableName) !== 1) {
        return [];
    }

    $stmt = $pdo->query('SHOW COLUMNS FROM ' . users_api_quote_identifier($tableName));
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    $columns = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $columnName = trim((string) ($row['Field'] ?? ''));
        if ($columnName === '' || preg_match('/^[A-Za-z0-9_]+$/', $columnName) !== 1) {
            continue;
        }
        $columns[] = $columnName;
    }
    return $columns;
}

/**
 * @return array<string, string>
 */
function users_api_backup_required_sync_procedures(): array
{
    return [
        'sp_sync_registration_household' => '2026-02-25_create_sp_sync_registration_household.sql',
        'sp_sync_registration_member' => '2026-02-25_create_sp_sync_registration_member.sql',
    ];
}

function users_api_backup_procedure_exists(PDO $pdo, string $procedureName): bool
{
    if ($procedureName === '' || preg_match('/^[A-Za-z0-9_]+$/', $procedureName) !== 1) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1
         FROM `information_schema`.`ROUTINES`
         WHERE `ROUTINE_SCHEMA` = DATABASE()
           AND `ROUTINE_TYPE` = "PROCEDURE"
           AND `ROUTINE_NAME` = :routine_name
         LIMIT 1'
    );
    $stmt->execute([
        'routine_name' => $procedureName,
    ]);

    return (bool) $stmt->fetchColumn();
}

function users_api_backup_migration_path(string $fileName): string
{
    return __DIR__ . '/database/migrations/' . $fileName;
}

function users_api_backup_execute_migration_sql(PDO $pdo, string $migrationFileName): void
{
    $path = users_api_backup_migration_path($migrationFileName);
    if (!is_file($path)) {
        throw new RuntimeException('Missing migration file: ' . $migrationFileName);
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        throw new RuntimeException('Migration file is empty: ' . $migrationFileName);
    }

    $lines = preg_split('/\r\n|\r|\n/', $raw);
    if (!is_array($lines)) {
        throw new RuntimeException('Unable to parse migration file: ' . $migrationFileName);
    }

    $delimiter = ';';
    $buffer = '';
    foreach ($lines as $line) {
        $lineText = (string) $line;
        $trimmed = trim($lineText);
        if ($trimmed === '' || preg_match('/^--/', $trimmed) === 1) {
            continue;
        }

        if (preg_match('/^DELIMITER\s+(.+)$/i', $trimmed, $matches) === 1) {
            $nextDelimiter = trim((string) ($matches[1] ?? ''));
            if ($nextDelimiter !== '') {
                $delimiter = $nextDelimiter;
            }
            continue;
        }

        $buffer .= $lineText . "\n";
        $lineForCheck = rtrim($lineText);
        if (
            $delimiter !== ''
            && strlen($lineForCheck) >= strlen($delimiter)
            && substr($lineForCheck, -strlen($delimiter)) === $delimiter
        ) {
            $statement = trim($buffer);
            $position = strrpos($statement, $delimiter);
            if ($position !== false) {
                $statement = rtrim(substr($statement, 0, $position));
            }
            if ($statement !== '') {
                $pdo->exec($statement);
            }
            $buffer = '';
        }
    }

    $remaining = trim($buffer);
    if ($remaining !== '') {
        $pdo->exec($remaining);
    }
}

function users_api_backup_ensure_sync_procedures(PDO $pdo): void
{
    foreach (users_api_backup_required_sync_procedures() as $procedureName => $migrationFileName) {
        if (users_api_backup_procedure_exists($pdo, $procedureName)) {
            continue;
        }

        try {
            users_api_backup_execute_migration_sql($pdo, $migrationFileName);
        } catch (Throwable $exception) {
            throw new RuntimeException(
                'Unable to install required database routine: ' . $procedureName . '. ' . $exception->getMessage(),
                0,
                $exception
            );
        }

        if (!users_api_backup_procedure_exists($pdo, $procedureName)) {
            throw new RuntimeException('Failed to install required database routine: ' . $procedureName . '.');
        }
    }
}

function users_api_backup_database_name(PDO $pdo): string
{
    try {
        $stmt = $pdo->query('SELECT DATABASE()');
        if ($stmt instanceof PDOStatement) {
            $value = $stmt->fetchColumn();
            if (is_string($value)) {
                return trim($value);
            }
        }
    } catch (Throwable $exception) {
        // Fallback to empty database name.
    }

    return '';
}

/**
 * @return array<string, mixed>
 */
function users_api_backup_export_payload(PDO $pdo): array
{
    $tables = users_api_backup_table_names($pdo);
    $tablePayload = [];
    foreach ($tables as $tableName) {
        $columns = users_api_backup_table_columns($pdo, $tableName);
        $stmt = $pdo->query('SELECT * FROM ' . users_api_quote_identifier($tableName));
        $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        $tablePayload[$tableName] = [
            'columns' => $columns,
            'rows' => is_array($rows) ? $rows : [],
            'row_count' => is_array($rows) ? count($rows) : 0,
        ];
    }

    return [
        'backup_version' => 1,
        'created_at' => gmdate('c'),
        'database' => users_api_backup_database_name($pdo),
        'tables' => $tablePayload,
    ];
}

/**
 * @return array<string, mixed>
 */
function users_api_backup_create(PDO $pdo): array
{
    $directory = users_api_backup_ensure_directory();
    $backupPayload = users_api_backup_export_payload($pdo);
    $encoded = json_encode(
        $backupPayload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if (!is_string($encoded) || $encoded === '') {
        users_api_error(500, 'Unable to encode backup file.');
    }

    $token = '';
    try {
        $token = bin2hex(random_bytes(4));
    } catch (Throwable $exception) {
        $token = str_replace('.', '', uniqid('', true));
    }
    $fileName = 'hims-backup-' . gmdate('Ymd-His') . '-' . $token . '.json';
    $absolutePath = $directory . '/' . $fileName;

    $writtenBytes = @file_put_contents($absolutePath, $encoded, LOCK_EX);
    if (!is_int($writtenBytes) || $writtenBytes <= 0) {
        users_api_error(500, 'Unable to write backup file.');
    }

    $modifiedValue = @filemtime($absolutePath);
    $createdAt = is_int($modifiedValue) && $modifiedValue > 0
        ? gmdate('c', $modifiedValue)
        : gmdate('c');

    return [
        'file_name' => $fileName,
        'relative_path' => users_api_backup_relative_directory() . '/' . $fileName,
        'size_bytes' => $writtenBytes,
        'size_label' => users_api_backup_human_size($writtenBytes),
        'created_at' => $createdAt,
    ];
}

/**
 * @return array<string, mixed>
 */
function users_api_backup_decode_payload(string $raw): array
{
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        users_api_error(422, 'Backup file is not a valid JSON document.');
    }

    if (!isset($decoded['tables']) || !is_array($decoded['tables'])) {
        users_api_error(422, 'Backup file has invalid table data.');
    }

    return $decoded;
}

/**
 * @return array{file_name:string,size_bytes:int,payload:array<string,mixed>}
 */
function users_api_uploaded_backup_file(): array
{
    $file = $_FILES['backup_file'] ?? null;
    if (!is_array($file)) {
        users_api_error(422, 'Backup file is required.');
    }

    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) {
        users_api_error(422, 'Backup file is required.');
    }
    if ($error !== UPLOAD_ERR_OK) {
        users_api_error(422, 'Failed to upload backup file.');
    }

    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_file($tmpPath)) {
        users_api_error(422, 'Uploaded backup file is invalid.');
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0) {
        users_api_error(422, 'Uploaded backup file is empty.');
    }
    if ($size > USERS_API_BACKUP_MAX_UPLOAD_BYTES) {
        users_api_error(413, 'Backup file must be 25MB or less.');
    }

    $fileName = users_api_backup_normalized_file_name($file['name'] ?? '', false);
    if ($fileName === '') {
        users_api_error(422, 'Backup file must be a .json file.');
    }

    $raw = file_get_contents($tmpPath);
    if (!is_string($raw) || $raw === '') {
        users_api_error(422, 'Uploaded backup file is invalid.');
    }

    return [
        'file_name' => $fileName,
        'size_bytes' => strlen($raw),
        'payload' => users_api_backup_decode_payload($raw),
    ];
}

/**
 * @return array<string, string>
 */
function users_api_backup_existing_table_map(PDO $pdo): array
{
    $map = [];
    foreach (users_api_backup_table_names($pdo) as $tableName) {
        $map[strtolower($tableName)] = $tableName;
    }
    return $map;
}

/**
 * @param array<int, mixed> $columns
 * @return array<int, string>
 */
function users_api_backup_normalize_columns(array $columns): array
{
    $normalized = [];
    foreach ($columns as $value) {
        $column = trim((string) $value);
        if ($column === '' || preg_match('/^[A-Za-z0-9_]+$/', $column) !== 1) {
            continue;
        }
        if (!in_array($column, $normalized, true)) {
            $normalized[] = $column;
        }
    }
    return $normalized;
}

/**
 * @param array<string, mixed> $backupPayload
 * @return array{tables_restored:int,rows_restored:int}
 */
function users_api_backup_restore(PDO $pdo, array $backupPayload): array
{
    $tablesNode = $backupPayload['tables'] ?? null;
    if (!is_array($tablesNode) || $tablesNode === []) {
        users_api_error(422, 'Backup file does not contain restorable table data.');
    }

    $existingTables = users_api_backup_existing_table_map($pdo);
    if ($existingTables === []) {
        users_api_error(422, 'Current database has no restorable tables.');
    }

    users_api_backup_ensure_sync_procedures($pdo);

    $preparedTables = [];
    foreach ($tablesNode as $rawTableName => $tableData) {
        $tableName = trim((string) $rawTableName);
        if ($tableName === '' || preg_match('/^[A-Za-z0-9_]+$/', $tableName) !== 1) {
            continue;
        }

        $existingName = $existingTables[strtolower($tableName)] ?? '';
        if ($existingName === '' || !is_array($tableData)) {
            continue;
        }

        $rows = [];
        $rawRows = $tableData['rows'] ?? [];
        if (is_array($rawRows)) {
            foreach ($rawRows as $row) {
                if (is_array($row)) {
                    $rows[] = $row;
                }
            }
        }

        $columns = users_api_backup_normalize_columns(is_array($tableData['columns'] ?? null) ? $tableData['columns'] : []);
        if ($columns === [] && $rows !== []) {
            $firstRow = $rows[0] ?? [];
            if (is_array($firstRow)) {
                $columns = users_api_backup_normalize_columns(array_keys($firstRow));
            }
        }

        $existingColumns = users_api_backup_table_columns($pdo, $existingName);
        $columns = array_values(array_intersect($columns, $existingColumns));
        if ($rows !== [] && $columns === []) {
            users_api_error(422, 'Backup file is incompatible with table schema: ' . $existingName . '.');
        }

        $preparedTables[$existingName] = [
            'columns' => $columns,
            'rows' => $rows,
        ];
    }

    if ($preparedTables === []) {
        users_api_error(422, 'Backup file does not match current database tables.');
    }

    $tablesRestored = 0;
    $rowsRestored = 0;
    $foreignKeysDisabled = false;

    $pdo->beginTransaction();
    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $foreignKeysDisabled = true;

        foreach ($preparedTables as $tableName => $tableData) {
            if (!is_string($tableName) || $tableName === '' || !is_array($tableData)) {
                continue;
            }

            $pdo->exec('DELETE FROM ' . users_api_quote_identifier($tableName));

            $columns = is_array($tableData['columns'] ?? null) ? $tableData['columns'] : [];
            $rows = is_array($tableData['rows'] ?? null) ? $tableData['rows'] : [];
            if ($columns !== [] && $rows !== []) {
                $columnSql = [];
                $placeholderSql = [];
                foreach ($columns as $index => $columnName) {
                    $columnSql[] = users_api_quote_identifier((string) $columnName);
                    $placeholderSql[] = ':c' . $index;
                }

                $insertSql = 'INSERT INTO ' . users_api_quote_identifier($tableName)
                    . ' (' . implode(', ', $columnSql) . ')'
                    . ' VALUES (' . implode(', ', $placeholderSql) . ')';
                $insertStmt = $pdo->prepare($insertSql);

                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $params = [];
                    foreach ($columns as $index => $columnName) {
                        $columnKey = (string) $columnName;
                        $params['c' . $index] = array_key_exists($columnKey, $row) ? $row[$columnKey] : null;
                    }
                    $insertStmt->execute($params);
                    $rowsRestored++;
                }
            }

            $tablesRestored++;
        }

        if ($foreignKeysDisabled) {
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
            $foreignKeysDisabled = false;
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($foreignKeysDisabled) {
            try {
                $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
            } catch (Throwable $ignored) {
                // Best effort only.
            }
        }
        throw $exception;
    }

    return [
        'tables_restored' => $tablesRestored,
        'rows_restored' => $rowsRestored,
    ];
}

/**
 * @param array<string, mixed> $fileMeta
 * @return array<string, mixed>
 */
function users_api_backup_download_payload(array $fileMeta): array
{
    $absolutePath = (string) ($fileMeta['absolute_path'] ?? '');
    $fileName = users_api_backup_normalized_file_name($fileMeta['file_name'] ?? '');
    if ($absolutePath === '' || $fileName === '' || !is_file($absolutePath)) {
        users_api_error(404, 'Backup file not found.');
    }

    $sizeValue = @filesize($absolutePath);
    $sizeBytes = is_int($sizeValue) && $sizeValue > 0 ? $sizeValue : 0;
    if ($sizeBytes <= 0) {
        users_api_error(500, 'Backup file is empty.');
    }
    if ($sizeBytes > USERS_API_BACKUP_MAX_DOWNLOAD_BYTES) {
        users_api_error(413, 'Backup file is too large to download via API.');
    }

    $raw = file_get_contents($absolutePath);
    if (!is_string($raw) || $raw === '') {
        users_api_error(500, 'Unable to read backup file.');
    }

    return [
        'file_name' => $fileName,
        'mime_type' => 'application/json',
        'size_bytes' => $sizeBytes,
        'content_base64' => base64_encode($raw),
    ];
}

function users_api_backup_restore_friendly_error(Throwable $exception): string
{
    $message = strtolower(trim($exception->getMessage()));
    if ($message === '') {
        return 'Restore failed: backup file may be incompatible with current database schema.';
    }

    if (
        strpos($message, 'unable to install required database routine') !== false
        || strpos($message, 'failed to install required database routine') !== false
        || strpos($message, 'missing migration file') !== false
    ) {
        return 'Restore failed: required database sync routines are missing. Please run migrations and try again.';
    }

    if (
        (strpos($message, 'procedure') !== false && strpos($message, 'does not exist') !== false)
        || strpos($message, 'create routine command denied') !== false
    ) {
        return 'Restore failed: database sync routines are missing or not allowed for this database user.';
    }

    if (
        strpos($message, 'doesn\'t have a default value') !== false
        || strpos($message, 'cannot be null') !== false
        || strpos($message, 'unknown column') !== false
        || strpos($message, 'column count doesn\'t match') !== false
    ) {
        return 'Restore failed: backup file structure does not match the current database schema.';
    }

    if (strpos($message, 'foreign key') !== false) {
        return 'Restore failed: backup data has relationship conflicts.';
    }

    if (strpos($message, 'duplicate entry') !== false) {
        return 'Restore failed: duplicate values were found in backup data.';
    }

    return 'Restore failed: backup file may be incompatible with current database schema.';
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
        'barangay_profile' => users_api_barangay_profile($pdo),
        'backup_status' => users_api_backup_status_payload(),
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

$payload = users_api_read_request_payload();
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

        $adminUserId = (int) ($adminAccount['id'] ?? 0);
        $affectedStaffCount = 0;
        $nextStatusFlag = $status === 'active' ? 1 : 0;
        $oppositeStatusFlag = $status === 'active' ? 0 : 1;

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'UPDATE `users`
                 SET `is_active` = :is_active, `updated_at` = CURRENT_TIMESTAMP
                 WHERE `id` = :id AND `role` = :role
                 LIMIT 1'
            );
            $stmt->execute([
                'is_active' => $nextStatusFlag,
                'id' => $adminUserId,
                'role' => AUTH_ROLE_SECRETARY,
            ]);

            $staffStmt = $pdo->prepare(
                'UPDATE `users`
                 SET `is_active` = :is_active, `updated_at` = CURRENT_TIMESTAMP
                 WHERE `role` = :role AND `is_active` = :from_is_active'
            );
            $staffStmt->execute([
                'is_active' => $nextStatusFlag,
                'role' => AUTH_ROLE_STAFF,
                'from_is_active' => $oppositeStatusFlag,
            ]);
            $affectedStaffCount = (int) $staffStmt->rowCount();

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        users_api_audit_log(
            $authUser,
            'settings_admin_status_updated',
            'updated',
            $status === 'active'
                ? 'Activated admin account and staff accounts.'
                : 'Deactivated admin account and staff accounts.',
            'user',
            (string) ($adminAccount['username'] ?? ''),
            [
                'target_role' => AUTH_ROLE_SECRETARY,
                'target_user_id' => $adminUserId,
                'status' => $status,
                'affected_staff_count' => $affectedStaffCount,
            ]
        );

        $message = $status === 'active'
            ? (
                $affectedStaffCount > 0
                    ? 'Admin account activated. Staff accounts under admin were also activated.'
                    : 'Admin account activated.'
            )
            : (
                $affectedStaffCount > 0
                    ? 'Admin account deactivated. Staff accounts under admin were also deactivated.'
                    : 'Admin account deactivated.'
            );

        users_api_respond(200, [
            'success' => true,
            'message' => $message,
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'save_barangay_profile') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        users_api_ensure_barangay_profile_table($pdo);

        $barangayName = users_api_text($payload['barangay_name'] ?? '', 160);
        $barangayCode = users_api_text($payload['barangay_code'] ?? '', 80);
        $captainName = users_api_text($payload['captain_name'] ?? '', 160);
        $secretaryName = users_api_text($payload['secretary_name'] ?? '', 160);
        $sealUpload = users_api_uploaded_official_seal();
        if (!is_array($sealUpload)) {
            $sealUpload = users_api_decode_official_seal_data($payload['official_seal_data'] ?? null);
        }

        $existingSealPath = '';
        $sealPathStmt = $pdo->prepare(
            'SELECT `official_seal_path`
             FROM `barangay_profile`
             WHERE `id` = 1
             LIMIT 1'
        );
        $sealPathStmt->execute();
        $existingSealPathRaw = $sealPathStmt->fetchColumn();
        if (is_string($existingSealPathRaw)) {
            $existingSealPath = users_api_text($existingSealPathRaw, 255);
        }

        $officialSealPath = $existingSealPath;
        if (is_array($sealUpload)) {
            $sealDirectory = __DIR__ . '/assets/img/official-seals';
            if (!is_dir($sealDirectory)) {
                $created = @mkdir($sealDirectory, 0775, true);
                if ($created !== true && !is_dir($sealDirectory)) {
                    users_api_error(500, 'Unable to create official seal storage directory.');
                }
            }

            $token = '';
            try {
                $token = bin2hex(random_bytes(6));
            } catch (Throwable $exception) {
                $token = str_replace('.', '', uniqid('', true));
            }
            $fileName = 'official-seal-' . date('YmdHis') . '-' . $token . '.' . $sealUpload['extension'];
            $absoluteFilePath = $sealDirectory . '/' . $fileName;
            $savedBytes = @file_put_contents($absoluteFilePath, $sealUpload['binary']);
            if (!is_int($savedBytes) || $savedBytes <= 0) {
                users_api_error(500, 'Unable to save official seal image.');
            }
            $officialSealPath = 'assets/img/official-seals/' . $fileName;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO `barangay_profile` (
                `id`,
                `barangay_name`,
                `barangay_code`,
                `captain_name`,
                `secretary_name`,
                `official_seal_path`,
                `updated_at`
             ) VALUES (
                1,
                :barangay_name,
                :barangay_code,
                :captain_name,
                :secretary_name,
                :official_seal_path,
                CURRENT_TIMESTAMP
             )
             ON DUPLICATE KEY UPDATE
                `barangay_name` = VALUES(`barangay_name`),
                `barangay_code` = VALUES(`barangay_code`),
                `captain_name` = VALUES(`captain_name`),
                `secretary_name` = VALUES(`secretary_name`),
                `official_seal_path` = VALUES(`official_seal_path`),
                `updated_at` = CURRENT_TIMESTAMP'
        );
        $stmt->execute([
            'barangay_name' => $barangayName,
            'barangay_code' => $barangayCode,
            'captain_name' => $captainName,
            'secretary_name' => $secretaryName,
            'official_seal_path' => $officialSealPath,
        ]);

        if (is_array($sealUpload) && $existingSealPath !== '' && $existingSealPath !== $officialSealPath) {
            users_api_delete_official_seal_file($existingSealPath);
        }

        users_api_audit_log(
            $authUser,
            'settings_barangay_profile_updated',
            'updated',
            'Updated barangay profile details.',
            'barangay_profile',
            '1',
            [
                'barangay_name' => $barangayName,
                'barangay_code' => $barangayCode,
                'captain_name' => $captainName,
                'secretary_name' => $secretaryName,
                'official_seal_path' => $officialSealPath,
                'official_seal_uploaded' => is_array($sealUpload),
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Barangay profile saved successfully.',
            'data' => users_api_settings_payload($pdo, $authUser),
        ]);
    }

    if ($action === 'run_backup') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        $backupMeta = users_api_backup_create($pdo);
        $fileName = (string) ($backupMeta['file_name'] ?? '');

        users_api_audit_log(
            $authUser,
            'settings_backup_created',
            'created',
            'Created system backup file.',
            'backup',
            $fileName,
            [
                'file_name' => $fileName,
                'size_bytes' => (int) ($backupMeta['size_bytes'] ?? 0),
                'created_at' => (string) ($backupMeta['created_at'] ?? ''),
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Backup completed successfully.',
            'data' => users_api_settings_payload($pdo, $authUser),
            'backup' => $backupMeta,
        ]);
    }

    if ($action === 'download_backup') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        $requestedFileName = users_api_backup_normalized_file_name($payload['file_name'] ?? '');
        $selectedBackup = $requestedFileName !== ''
            ? users_api_backup_find_file_by_name($requestedFileName)
            : users_api_backup_latest_file();

        if (!is_array($selectedBackup)) {
            users_api_error(404, 'No backup file available for download.');
        }

        $downloadPayload = users_api_backup_download_payload($selectedBackup);
        $fileName = (string) ($downloadPayload['file_name'] ?? '');

        users_api_audit_log(
            $authUser,
            'settings_backup_downloaded',
            'access',
            'Downloaded backup file.',
            'backup',
            $fileName,
            [
                'file_name' => $fileName,
                'size_bytes' => (int) ($downloadPayload['size_bytes'] ?? 0),
            ]
        );

        users_api_respond(200, [
            'success' => true,
            'message' => 'Backup file is ready for download.',
            'data' => users_api_settings_payload($pdo, $authUser),
            'download' => $downloadPayload,
        ]);
    }

    if ($action === 'restore_backup') {
        users_api_require_role($requesterRole, [AUTH_ROLE_CAPTAIN]);

        try {
            $uploadedBackup = users_api_uploaded_backup_file();
            $restoreResult = users_api_backup_restore($pdo, (array) ($uploadedBackup['payload'] ?? []));
            $fileName = (string) ($uploadedBackup['file_name'] ?? '');

            $currentUserId = (int) ($authUser['id'] ?? 0);
            if ($currentUserId > 0) {
                $refreshedUser = users_api_find_user($pdo, $currentUserId);
                if (is_array($refreshedUser)) {
                    users_api_refresh_session_user($refreshedUser);
                    if (isset($_SESSION[AUTH_SESSION_USER_KEY]) && is_array($_SESSION[AUTH_SESSION_USER_KEY])) {
                        $authUser = $_SESSION[AUTH_SESSION_USER_KEY];
                    }
                }
            }

            users_api_audit_log(
                is_array($authUser) ? $authUser : [],
                'settings_backup_restored',
                'updated',
                'Restored system data from backup file.',
                'backup',
                $fileName,
                [
                    'file_name' => $fileName,
                    'size_bytes' => (int) ($uploadedBackup['size_bytes'] ?? 0),
                    'tables_restored' => (int) ($restoreResult['tables_restored'] ?? 0),
                    'rows_restored' => (int) ($restoreResult['rows_restored'] ?? 0),
                ]
            );

            users_api_respond(200, [
                'success' => true,
                'message' => 'Backup restore completed successfully.',
                'data' => users_api_settings_payload($pdo, is_array($authUser) ? $authUser : []),
                'restore' => $restoreResult,
            ]);
        } catch (Throwable $exception) {
            $restoreFileName = users_api_backup_normalized_file_name($_FILES['backup_file']['name'] ?? '', false);
            $actorId = (int) ($authUser['id'] ?? 0);
            error_log(
                '[users-api][restore_backup] actor_id=' . $actorId
                . ' file=' . $restoreFileName
                . ' error=' . $exception->getMessage()
            );
            users_api_error(422, users_api_backup_restore_friendly_error($exception));
        }
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
    error_log(
        '[users-api] action=' . $action
        . ' actor_id=' . (int) ($authUser['id'] ?? 0)
        . ' error=' . $exception->getMessage()
    );
    users_api_error(500, 'Unable to process request right now.');
}
