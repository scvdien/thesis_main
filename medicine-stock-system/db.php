<?php
declare(strict_types=1);

/**
 * @param array<int, string> $keys
 */
function mss_env(array $keys, string $default = ''): string
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

/**
 * @param callable(array<int, string>, string): string|null $envReader
 */
function mss_db_connection(?callable $envReader = null): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!class_exists('PDO')) {
        throw new RuntimeException('PDO extension is not available.');
    }

    $readEnv = $envReader ?? 'mss_env';
    $host = $readEnv(['DB_HOST'], '127.0.0.1');
    $port = $readEnv(['DB_PORT'], '3306');
    $username = $readEnv(['DB_USERNAME', 'DB_USER'], 'root');
    $password = $readEnv(['DB_PASSWORD', 'DB_PASS'], '');
    $database = $readEnv(['DB_NAME'], 'thesis_main');

    if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
        throw new RuntimeException('Invalid database name.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            $username,
            $password,
            $options
        );
    } catch (Throwable $exception) {
        $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $username, $password, $options);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$database}`");
    }

    mss_ensure_schema($pdo);

    return $pdo;
}

function mss_ensure_schema(PDO $pdo): void
{
    static $schemaReady = false;
    if ($schemaReady) {
        return;
    }

    $statements = [
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_users` (
  `id` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `username` VARCHAR(80) NOT NULL,
  `contact` VARCHAR(40) NOT NULL DEFAULT '',
  `account_type` VARCHAR(20) NOT NULL DEFAULT 'BHW',
  `role` VARCHAR(20) NOT NULL DEFAULT 'BHW',
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `password_hash` VARCHAR(255) NOT NULL,
  `credentials_updated_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `created_by` VARCHAR(150) NOT NULL DEFAULT '',
  `updated_at` DATETIME NOT NULL,
  `updated_by` VARCHAR(150) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mss_users_username` (`username`),
  KEY `idx_mss_users_role` (`role`),
  KEY `idx_mss_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_token` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL DEFAULT '',
  `username` VARCHAR(80) NOT NULL DEFAULT '',
  `role` VARCHAR(20) NOT NULL DEFAULT '',
  `account_type` VARCHAR(20) NOT NULL DEFAULT '',
  `presence` VARCHAR(30) NOT NULL DEFAULT 'Online',
  `location_label` VARCHAR(120) NOT NULL DEFAULT '',
  `device_label` VARCHAR(120) NOT NULL DEFAULT '',
  `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
  `signed_in_at` DATETIME NOT NULL,
  `last_seen_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mss_sessions_token` (`session_token`),
  KEY `idx_mss_sessions_user` (`user_id`),
  KEY `idx_mss_sessions_last_seen` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_activity_logs` (
  `id` VARCHAR(64) NOT NULL,
  `actor` VARCHAR(150) NOT NULL DEFAULT '',
  `username` VARCHAR(80) NOT NULL DEFAULT '',
  `action` VARCHAR(160) NOT NULL DEFAULT '',
  `action_type` VARCHAR(30) NOT NULL DEFAULT 'updated',
  `target` VARCHAR(160) NOT NULL DEFAULT '',
  `details` TEXT NOT NULL,
  `category` VARCHAR(60) NOT NULL DEFAULT 'General',
  `result_label` VARCHAR(40) NOT NULL DEFAULT 'Success',
  `result_tone` VARCHAR(20) NOT NULL DEFAULT 'success',
  `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_logs_created_at` (`created_at`),
  KEY `idx_mss_logs_category` (`category`),
  KEY `idx_mss_logs_action_type` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_inventory_records` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `generic_name` VARCHAR(160) NOT NULL DEFAULT '',
  `category` VARCHAR(80) NOT NULL DEFAULT 'Others',
  `form` VARCHAR(60) NOT NULL DEFAULT 'Tablet',
  `strength` VARCHAR(80) NOT NULL DEFAULT '',
  `stock_on_hand` INT NOT NULL DEFAULT 0,
  `reorder_level` INT NOT NULL DEFAULT 1,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'units',
  `batch_number` VARCHAR(80) NOT NULL DEFAULT '-',
  `expiry_date` DATE NULL,
  `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `record_status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `updated_by` VARCHAR(150) NOT NULL DEFAULT '',
  `last_updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mss_inventory_variant` (`name`, `form`, `strength`),
  KEY `idx_mss_inventory_record_status` (`record_status`),
  KEY `idx_mss_inventory_name` (`name`),
  KEY `idx_mss_inventory_category` (`category`),
  KEY `idx_mss_inventory_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_inventory_movements` (
  `id` VARCHAR(64) NOT NULL,
  `medicine_id` VARCHAR(64) NOT NULL DEFAULT '',
  `medicine_name` VARCHAR(160) NOT NULL DEFAULT '',
  `action_type` VARCHAR(30) NOT NULL DEFAULT 'adjusted',
  `quantity` INT NOT NULL DEFAULT 0,
  `disease_category` VARCHAR(120) NOT NULL DEFAULT '',
  `illness` VARCHAR(160) NOT NULL DEFAULT '',
  `note` TEXT NOT NULL,
  `stock_before` INT NOT NULL DEFAULT 0,
  `stock_after` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `user_name` VARCHAR(150) NOT NULL DEFAULT '',
  `recipient_id` VARCHAR(64) NOT NULL DEFAULT '',
  `recipient_name` VARCHAR(150) NOT NULL DEFAULT '',
  `recipient_barangay` VARCHAR(120) NOT NULL DEFAULT '',
  `released_by_role` VARCHAR(40) NOT NULL DEFAULT '',
  `released_by_name` VARCHAR(150) NOT NULL DEFAULT '',
  `linked_request_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_item_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_group_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_code` VARCHAR(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_mss_movements_created_at` (`created_at`),
  KEY `idx_mss_movements_medicine_id` (`medicine_id`),
  KEY `idx_mss_movements_action_type` (`action_type`),
  KEY `idx_mss_movements_request_group` (`linked_request_group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_resident_accounts` (
  `id` VARCHAR(64) NOT NULL,
  `resident_id` VARCHAR(64) NOT NULL DEFAULT '',
  `household_id` VARCHAR(64) NOT NULL DEFAULT '',
  `full_name` VARCHAR(160) NOT NULL,
  `barangay` VARCHAR(120) NOT NULL DEFAULT 'Cabarian',
  `zone` VARCHAR(80) NOT NULL DEFAULT '',
  `city` VARCHAR(120) NOT NULL DEFAULT 'Ligao City',
  `province` VARCHAR(120) NOT NULL DEFAULT 'Albay',
  `address` VARCHAR(255) NOT NULL DEFAULT '',
  `source` VARCHAR(60) NOT NULL DEFAULT 'medicine-system',
  `last_dispensed_at` DATETIME NULL,
  `last_dispensed_medicine` VARCHAR(160) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_mss_residents_resident_id` (`resident_id`),
  KEY `idx_mss_residents_full_name` (`full_name`),
  KEY `idx_mss_residents_barangay` (`barangay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_cho_requests` (
  `id` VARCHAR(64) NOT NULL,
  `request_group_id` VARCHAR(64) NOT NULL,
  `request_code` VARCHAR(50) NOT NULL DEFAULT '',
  `medicine_id` VARCHAR(64) NOT NULL DEFAULT '',
  `medicine_name` VARCHAR(160) NOT NULL DEFAULT '',
  `generic_name` VARCHAR(160) NOT NULL DEFAULT '',
  `strength` VARCHAR(80) NOT NULL DEFAULT '',
  `unit` VARCHAR(40) NOT NULL DEFAULT 'units',
  `quantity_requested` INT NOT NULL DEFAULT 1,
  `request_date` DATE NOT NULL,
  `expected_date` DATE NOT NULL,
  `source` VARCHAR(150) NOT NULL DEFAULT 'City Health Office (CHO)',
  `requested_by` VARCHAR(150) NOT NULL DEFAULT 'Nurse-in-Charge',
  `notes` TEXT NOT NULL,
  `record_status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_requests_group` (`request_group_id`),
  KEY `idx_mss_requests_code` (`request_code`),
  KEY `idx_mss_requests_request_date` (`request_date`),
  KEY `idx_mss_requests_expected_date` (`expected_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_notifications` (
  `id` VARCHAR(64) NOT NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'Medicine Status',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
  `title` VARCHAR(180) NOT NULL,
  `body` TEXT NOT NULL,
  `source` VARCHAR(120) NOT NULL DEFAULT '',
  `recommendation` TEXT NOT NULL,
  `signature` VARCHAR(255) NOT NULL DEFAULT '',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_notifications_priority` (`priority`),
  KEY `idx_mss_notifications_read` (`is_read`),
  KEY `idx_mss_notifications_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_report_history` (
  `id` VARCHAR(64) NOT NULL,
  `format` VARCHAR(20) NOT NULL DEFAULT 'pdf',
  `report_key` VARCHAR(80) NOT NULL DEFAULT 'report',
  `report_label` VARCHAR(160) NOT NULL DEFAULT 'Report',
  `report_title` VARCHAR(180) NOT NULL DEFAULT 'Generated Report',
  `report_description` TEXT NOT NULL,
  `submission_label` VARCHAR(180) NOT NULL DEFAULT '',
  `data_source` VARCHAR(180) NOT NULL DEFAULT '',
  `prepared_by` VARCHAR(150) NOT NULL DEFAULT '',
  `row_count` INT NOT NULL DEFAULT 0,
  `generated_at` DATETIME NOT NULL,
  `report_definition_json` MEDIUMTEXT NOT NULL,
  `table_rows_json` MEDIUMTEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_report_history_generated_at` (`generated_at`),
  KEY `idx_mss_report_history_format` (`format`),
  KEY `idx_mss_report_history_key` (`report_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        <<<'SQL'
CREATE TABLE IF NOT EXISTS `mss_client_state` (
  `state_key` VARCHAR(100) NOT NULL,
  `state_json` MEDIUMTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    ];

    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }

    mss_ensure_table_column(
        $pdo,
        'mss_inventory_records',
        'record_status',
        "ALTER TABLE `mss_inventory_records` ADD COLUMN `record_status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `unit_cost`"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_records',
        'idx_mss_inventory_record_status',
        "ALTER TABLE `mss_inventory_records` ADD KEY `idx_mss_inventory_record_status` (`record_status`)"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'disease_category',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `disease_category` VARCHAR(120) NOT NULL DEFAULT '' AFTER `quantity`"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'illness',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `illness` VARCHAR(160) NOT NULL DEFAULT '' AFTER `disease_category`"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_cho_requests',
        'record_status',
        "ALTER TABLE `mss_cho_requests` ADD COLUMN `record_status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `notes`"
    );

    $schemaReady = true;
}

function mss_ensure_table_column(PDO $pdo, string $table, string $column, string $statement): void
{
    $quotedColumn = $pdo->quote($column);
    $query = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE {$quotedColumn}");
    if ($query && $query->fetch()) {
        return;
    }

    $pdo->exec($statement);
}

function mss_ensure_table_index(PDO $pdo, string $table, string $index, string $statement): void
{
    $quotedIndex = $pdo->quote($index);
    $query = $pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = {$quotedIndex}");
    if ($query && $query->fetch()) {
        return;
    }

    $pdo->exec($statement);
}
