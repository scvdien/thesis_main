<?php
declare(strict_types=1);

/**
 * @return array<string, string>
 */
function mss_config_accepts_empty_value(string $key): bool
{
    return in_array($key, ['DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD'], true);
}

/**
 * @return array<string, string>
 */
function mss_file_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $config = [];
    $rootDir = dirname(__DIR__);
    $paths = [
        __DIR__ . DIRECTORY_SEPARATOR . 'db.runtime.php',
        __DIR__ . DIRECTORY_SEPARATOR . 'db.config.php',
        $rootDir . DIRECTORY_SEPARATOR . 'db.runtime.php',
        $rootDir . DIRECTORY_SEPARATOR . 'db.config.php',
    ];

    foreach ($paths as $path) {
        if (!is_file($path)) {
            continue;
        }

        $loaded = require $path;
        if (!is_array($loaded)) {
            continue;
        }

        foreach ($loaded as $key => $value) {
            if ((!is_string($key) && !is_int($key)) || !is_scalar($value)) {
                continue;
            }

            $normalizedKey = strtoupper(trim((string) $key));
            $normalizedValue = trim((string) $value);
            if ($normalizedKey === '') {
                continue;
            }
            if ($normalizedValue === '' && !mss_config_accepts_empty_value($normalizedKey)) {
                continue;
            }

            if (!array_key_exists($normalizedKey, $config)) {
                $config[$normalizedKey] = $normalizedValue;
            }
        }
    }

    return $config;
}

/**
 * @param array<int, string> $keys
 */
function mss_env(array $keys, string $default = ''): string
{
    $fileConfig = mss_file_config();
    foreach ($keys as $key) {
        $normalizedKey = strtoupper(trim((string) $key));
        if ($normalizedKey !== '' && isset($fileConfig[$normalizedKey])) {
            return $fileConfig[$normalizedKey];
        }

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

    return trim($default);
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
    $host = $readEnv(['DB_HOST', 'MYSQL_HOST'], 'localhost');
    $port = $readEnv(['DB_PORT', 'MYSQL_PORT'], '3306');
    $username = $readEnv(['DB_USERNAME', 'DB_USER', 'MYSQL_USER'], 'root');
    $password = $readEnv(['DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD'], '');
    $database = $readEnv(['DB_NAME', 'DB_DATABASE', 'MYSQL_DATABASE'], 'thesis_main');

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
        throw new RuntimeException(
            'Database connection failed. Check DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, and DB_PASSWORD.',
            0,
            $exception
        );
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
  `password_verified_at` DATETIME NULL,
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
CREATE TABLE IF NOT EXISTS `mss_inventory_batches` (
  `id` VARCHAR(64) NOT NULL,
  `medicine_id` VARCHAR(64) NOT NULL,
  `batch_number` VARCHAR(80) NOT NULL,
  `expiry_date` DATE NOT NULL,
  `quantity_received` INT NOT NULL DEFAULT 0,
  `quantity_remaining` INT NOT NULL DEFAULT 0,
  `received_date` DATE NOT NULL,
  `source_type` VARCHAR(40) NOT NULL DEFAULT 'initial',
  `source_reference` VARCHAR(120) NOT NULL DEFAULT '',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_batches_med_expiry` (`medicine_id`, `expiry_date`),
  KEY `idx_mss_batches_medicine_id` (`medicine_id`),
  KEY `idx_mss_batches_status` (`status`),
  KEY `idx_mss_batches_number` (`batch_number`)
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
  `released_by_user_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_item_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_group_id` VARCHAR(64) NOT NULL DEFAULT '',
  `linked_request_code` VARCHAR(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_mss_movements_created_at` (`created_at`),
  KEY `idx_mss_movements_medicine_id` (`medicine_id`),
  KEY `idx_mss_movements_action_type` (`action_type`),
  KEY `idx_mss_movements_release_owner` (`action_type`, `released_by_user_id`, `created_at`),
  KEY `idx_mss_movements_request_group` (`linked_request_group_id`),
  KEY `idx_mss_movements_action_request_item` (`action_type`, `linked_request_item_id`),
  KEY `idx_mss_movements_action_request_id` (`action_type`, `linked_request_id`),
  KEY `idx_mss_movements_action_request_group` (`action_type`, `linked_request_group_id`),
  KEY `idx_mss_movements_action_request_code` (`action_type`, `linked_request_code`)
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
        'mss_sessions',
        'password_verified_at',
        "ALTER TABLE `mss_sessions` ADD COLUMN `password_verified_at` DATETIME NULL AFTER `ip_address`"
    );
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
    $movementOwnerColumnAdded = mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'released_by_user_id',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `released_by_user_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `released_by_name`"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_release_owner',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_release_owner` (`action_type`, `released_by_user_id`, `created_at`)"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_action_request_item',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_action_request_item` (`action_type`, `linked_request_item_id`)"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_action_request_id',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_action_request_id` (`action_type`, `linked_request_id`)"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_action_request_group',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_action_request_group` (`action_type`, `linked_request_group_id`)"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_action_request_code',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_action_request_code` (`action_type`, `linked_request_code`)"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_cho_requests',
        'record_status',
        "ALTER TABLE `mss_cho_requests` ADD COLUMN `record_status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `notes`"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'batch_id',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `batch_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `medicine_name`"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'batch_number',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `batch_number` VARCHAR(80) NOT NULL DEFAULT '' AFTER `batch_id`"
    );
    mss_ensure_table_column(
        $pdo,
        'mss_inventory_movements',
        'batch_expiry',
        "ALTER TABLE `mss_inventory_movements` ADD COLUMN `batch_expiry` DATE NULL AFTER `batch_number`"
    );
    mss_ensure_table_index(
        $pdo,
        'mss_inventory_movements',
        'idx_mss_movements_batch_id',
        "ALTER TABLE `mss_inventory_movements` ADD KEY `idx_mss_movements_batch_id` (`batch_id`)"
    );

    $pdo->exec(
        "INSERT INTO `mss_inventory_batches`
           (`id`, `medicine_id`, `batch_number`, `expiry_date`, `quantity_received`, `quantity_remaining`, `received_date`, `source_type`, `source_reference`, `status`, `created_at`, `updated_at`)
         SELECT
           CONCAT('batch_init_', MD5(CONCAT(m.`id`, '_', COALESCE(m.`batch_number`, 'init')))) AS `id`,
           m.`id` AS `medicine_id`,
           CASE WHEN TRIM(COALESCE(m.`batch_number`, '')) IN ('', '-') THEN 'INITIAL-BATCH' ELSE TRIM(m.`batch_number`) END AS `batch_number`,
           COALESCE(m.`expiry_date`, DATE_ADD(CURRENT_DATE, INTERVAL 1 YEAR)) AS `expiry_date`,
           m.`stock_on_hand` AS `quantity_received`,
           m.`stock_on_hand` AS `quantity_remaining`,
           COALESCE(DATE(m.`last_updated_at`), CURRENT_DATE) AS `received_date`,
           'initial' AS `source_type`,
           'Initial stock migration' AS `source_reference`,
           CASE WHEN m.`stock_on_hand` <= 0 THEN 'exhausted' ELSE 'active' END AS `status`,
           COALESCE(m.`last_updated_at`, NOW()) AS `created_at`,
           COALESCE(m.`last_updated_at`, NOW()) AS `updated_at`
         FROM `mss_inventory_records` m
         WHERE NOT EXISTS (
           SELECT 1 FROM `mss_inventory_batches` b WHERE b.`medicine_id` = m.`id`
         )"
    );

    if ($movementOwnerColumnAdded) {
        $pdo->exec(
            "UPDATE `mss_inventory_movements` AS `movement`
             INNER JOIN (
                 SELECT MIN(`id`) AS `user_id`, `full_name`
                 FROM `mss_users`
                 WHERE `full_name` <> ''
                 GROUP BY `full_name`
                 HAVING COUNT(*) = 1
             ) AS `owner`
                 ON `owner`.`full_name` = COALESCE(NULLIF(`movement`.`released_by_name`, ''), NULLIF(`movement`.`user_name`, ''))
             SET `movement`.`released_by_user_id` = `owner`.`user_id`
             WHERE LOWER(`movement`.`action_type`) IN ('dispense', 'issue', 'release', 'released')
               AND `movement`.`released_by_user_id` = ''"
        );
    }

    $schemaReady = true;
}

function mss_ensure_table_column(PDO $pdo, string $table, string $column, string $statement): bool
{
    $quotedColumn = $pdo->quote($column);
    $query = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE {$quotedColumn}");
    if ($query && $query->fetch()) {
        return false;
    }

    $pdo->exec($statement);
    return true;
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
