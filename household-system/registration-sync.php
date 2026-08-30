<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/registration-photo-storage.php';

const REG_MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
const REG_MAX_HOUSEHOLD_MEMBERS = 100;

/**
 * @param array<string, mixed> $payload
 */
function reg_respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function reg_error(int $statusCode, string $message): never
{
    reg_respond($statusCode, [
        'success' => false,
        'error' => $message,
    ]);
}

final class RegDuplicateHouseholdException extends RuntimeException
{
    /** @var array<string, mixed> */
    private $duplicate;

    /**
     * @param array<string, mixed> $duplicate
     */
    public function __construct(array $duplicate, string $message)
    {
        parent::__construct($message);
        $this->duplicate = $duplicate;
    }

    /**
     * @return array<string, mixed>
     */
    public function getDuplicate(): array
    {
        return is_array($this->duplicate) ? $this->duplicate : [];
    }
}

final class RegHouseholdConflictException extends RuntimeException
{
    /** @var array<string, mixed> */
    private $current;

    /** @param array<string, mixed> $current */
    public function __construct(array $current, string $message = '')
    {
        parent::__construct($message !== ''
            ? $message
            : 'This household changed on the server after the offline copy was loaded.');
        $this->current = $current;
    }

    /** @return array<string, mixed> */
    public function getCurrent(): array
    {
        return is_array($this->current) ? $this->current : [];
    }
}

function reg_text(mixed $value, int $maxLength = 255): string
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

function reg_quote_identifier(string $value): string
{
    return '`' . str_replace('`', '``', $value) . '`';
}

function reg_title_case_text(mixed $value): string
{
    $text = trim((string) $value);
    $text = preg_replace('/[\x00-\x1F\x7F]/u', '', $text);
    if (!is_string($text) || $text === '') {
        return '';
    }

    $text = preg_replace('/\s+/u', ' ', $text);
    if (!is_string($text) || $text === '') {
        return '';
    }

    $parts = preg_split('/(\s+)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
    if (!is_array($parts) || count($parts) === 0) {
        return $text;
    }

    $result = [];
    foreach ($parts as $part) {
        if ($part === '' || preg_match('/^\s+$/u', $part) === 1) {
            $result[] = $part;
            continue;
        }

        $lettersOnly = preg_replace('/[^[:alpha:]]/u', '', $part);
        if (!is_string($lettersOnly) || $lettersOnly === '') {
            $result[] = $part;
            continue;
        }

        $hasUpper = preg_match('/[[:upper:]]/u', $part) === 1;
        $hasLower = preg_match('/[[:lower:]]/u', $part) === 1;
        $letterLength = function_exists('mb_strlen')
            ? (int) mb_strlen($lettersOnly, 'UTF-8')
            : strlen($lettersOnly);

        // Keep short acronyms in all-caps (ex. SSS, PWD, RHU).
        if ($hasUpper && !$hasLower && $letterLength > 0 && $letterLength <= 4) {
            $result[] = $part;
            continue;
        }

        if (function_exists('mb_convert_case') && function_exists('mb_strtolower')) {
            $result[] = mb_convert_case(mb_strtolower($part, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
            continue;
        }

        $result[] = ucwords(strtolower($part));
    }

    return trim(implode('', $result));
}

function reg_normalize_zone_text(mixed $value): string
{
    $text = reg_text(reg_title_case_text($value), 80);
    if ($text === '') {
        return '';
    }

    $compact = preg_replace('/\s+/u', ' ', $text);
    if (!is_string($compact) || $compact === '') {
        return '';
    }

    if (preg_match('/^(?:zone|purok)\s*([[:alnum:]-]+)$/iu', $compact, $matches) === 1) {
        $suffix = reg_text($matches[1] ?? '', 30);
        if ($suffix === '') {
            return 'Zone';
        }
        if (preg_match('/^\d+$/', $suffix) === 1) {
            return 'Zone ' . (string) ((int) $suffix);
        }
        return 'Zone ' . strtoupper($suffix);
    }

    if (preg_match('/^\d+$/', $compact) === 1) {
        return 'Zone ' . (string) ((int) $compact);
    }

    return $compact;
}

/**
 * @param array<string, mixed> $person
 * @return array<string, mixed>
 */
function reg_strip_health_fields(array $person): array
{
    $fields = [
        'health_current_illness',
        'health_illness_type',
        'health_illness_years',
        'health_chronic_diseases',
        'health_common_illnesses',
        'health_maintenance_meds',
        'health_medicine_name',
        'health_medicine_frequency',
        'health_medicine_source',
        'health_maternal_pregnant',
        'health_months_pregnant',
        'health_prenatal_care',
        'health_child_immunized',
        'health_child_malnutrition',
        'health_child_sick_per_year',
        'health_has_disability',
        'health_disability_types',
        'health_disability_regular_care',
        'health_smoker',
        'health_alcohol_daily',
        'health_malnutrition_present',
        'health_clean_water',
        'health_rhu_visits',
        'health_rhu_reason',
        'health_has_philhealth',
        'health_hospitalized_5yrs',
        'health_hospitalized_reason',
        'healthNotes',
        '_hv_health_notes',
    ];

    foreach ($fields as $field) {
        unset($person[$field]);
    }

    return $person;
}

function reg_normalize_contact_number(mixed $value): string
{
    $raw = preg_replace('/\D/', '', (string) $value);
    if ($raw === '') {
        return '';
    }
    if (strlen($raw) === 10 && $raw[0] === '9') {
        return '0' . $raw;
    }
    if (strlen($raw) === 12 && substr($raw, 0, 3) === '639') {
        return '0' . substr($raw, 2);
    }
    if (strlen($raw) === 11 && substr($raw, 0, 2) === '09') {
        return $raw;
    }
    return $raw;
}

/**
 * @param array<string, mixed> $person
 * @return array<string, mixed>
 */
function reg_normalize_person_text_fields(array $person): array
{
    $person = reg_strip_health_fields($person);

    $titleCaseFields = [
        'first_name',
        'middle_name',
        'last_name',
        'extension_name',
        'head_name',
        'sex',
        'civil_status',
        'citizenship',
        'religion',
        'blood_type',
        'address',
        'zone',
        'barangay',
        'city',
        'province',
        'education',
        'degree',
        'school_name',
        'school_type',
        'occupation',
        'employment_status',
        'work_type',
        'relation_to_head',
        'partner_name',
        'ownership',
        'house_type',
        'toilet',
        'water',
    ];

    foreach ($titleCaseFields as $field) {
        if (!array_key_exists($field, $person)) {
            continue;
        }
        $person[$field] = reg_title_case_text($person[$field]);
    }

    return $person;
}

/**
 * Keep only an opaque server-validated photo id in person data. Image bytes,
 * data URLs, file paths, and client-provided URLs are never stored in JSON.
 *
 * @param array<string, mixed> $person
 * @return array<string, mixed>
 */
function reg_normalize_person_photo_reference(array $person): array
{
    foreach ([
        'photo',
        'photo_url',
        'photo_data',
        'profile_photo',
        'profile_photo_url',
        'profile_photo_data',
    ] as $unsafeField) {
        unset($person[$unsafeField]);
    }

    $photoId = reg_photo_normalize_id($person['profile_photo_id'] ?? '');
    if ($photoId === '') {
        unset($person['profile_photo_id']);
    } else {
        $person['profile_photo_id'] = $photoId;
    }
    return $person;
}

/** @param array<string, mixed> $person */
function reg_photo_person_match_key(array $person): string
{
    $parts = [];
    foreach (['first_name', 'middle_name', 'last_name', 'extension_name', 'birthday'] as $field) {
        $parts[] = strtolower(trim((string) ($person[$field] ?? '')));
    }
    $key = implode('|', $parts);
    return trim(str_replace('|', '', $key)) === '' ? '' : $key;
}

function reg_optional_client_member_id(mixed $value): string
{
    try {
        return reg_photo_normalize_id($value);
    } catch (InvalidArgumentException $exception) {
        return '';
    }
}

function reg_json_encode(mixed $value): string
{
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($json) ? $json : '{}';
}

/**
 * @return array<string, mixed>
 */
function reg_json_decode_assoc(?string $json): array
{
    if (!is_string($json) || trim($json) === '') {
        return [];
    }
    $decoded = json_decode($json, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * @return array<int, array<string, mixed>>
 */
function reg_normalize_members(mixed $value): array
{
    if (!is_array($value)) {
        return [];
    }
    $rows = [];
    foreach ($value as $item) {
        if (is_array($item)) {
            $rows[] = $item;
        }
    }
    return array_values($rows);
}

/**
 * @return array<string, mixed>
 */
function reg_read_json_body(): array
{
    $declaredLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($declaredLength > REG_MAX_JSON_BODY_BYTES) {
        reg_error(413, 'Registration payload is too large.');
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > REG_MAX_JSON_BODY_BYTES) {
        reg_error(413, 'Registration payload is too large.');
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        reg_error(400, 'Invalid JSON payload.');
    }
    return $decoded;
}

function reg_next_resident_code(PDO $pdo, string $householdCode): string
{
    static $counterByYear = [];
    $year = gmdate('Y');
    if (preg_match('/^HH-(\d{4})-\d+$/i', $householdCode, $match) === 1) {
        $year = $match[1];
    }

    if (!isset($counterByYear[$year])) {
        $stmt = $pdo->prepare(
            'SELECT MAX(CAST(SUBSTRING_INDEX(`resident_code`, "-", -1) AS UNSIGNED))
             FROM `registration_residents`
             WHERE `resident_code` LIKE :prefix'
        );
        $stmt->execute(['prefix' => "RS-{$year}-%"]);
        $counterByYear[$year] = (int) $stmt->fetchColumn();
    }

    $counterByYear[$year] += 1;
    return sprintf('RS-%s-%03d', $year, $counterByYear[$year]);
}

function reg_valid_record_year(int $year): bool
{
    return $year >= 2000 && $year <= 2100;
}

function reg_bootstrap_tables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_households` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `household_code` VARCHAR(64) NOT NULL,
            `client_record_id` VARCHAR(64) NULL DEFAULT NULL,
            `record_year` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `rollover_source_household_code` VARCHAR(64) NOT NULL DEFAULT "",
            `source` VARCHAR(80) NOT NULL DEFAULT "registration-module",
            `head_name` VARCHAR(180) NOT NULL DEFAULT "",
            `zone` VARCHAR(80) NOT NULL DEFAULT "",
            `member_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `head_data_json` LONGTEXT NOT NULL,
            `members_data_json` LONGTEXT NOT NULL,
            `record_data_json` LONGTEXT NOT NULL,
            `created_by_user_id` BIGINT UNSIGNED NULL,
            `updated_by_user_id` BIGINT UNSIGNED NULL,
            `row_version` BIGINT UNSIGNED NOT NULL DEFAULT 1,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_registration_households_code` (`household_code`),
            UNIQUE KEY `uq_registration_households_client_record` (`client_record_id`),
            KEY `idx_registration_households_record_year` (`record_year`),
            KEY `idx_registration_households_zone` (`zone`),
            KEY `idx_registration_households_updated_at` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_members` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `household_id` BIGINT UNSIGNED NOT NULL,
            `household_code` VARCHAR(64) NOT NULL,
            `record_year` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `resident_code` VARCHAR(64) NOT NULL,
            `member_order` INT UNSIGNED NOT NULL,
            `full_name` VARCHAR(220) NOT NULL DEFAULT "",
            `relation_to_head` VARCHAR(120) NOT NULL DEFAULT "",
            `sex` VARCHAR(20) NOT NULL DEFAULT "",
            `age` VARCHAR(20) NOT NULL DEFAULT "",
            `zone` VARCHAR(80) NOT NULL DEFAULT "",
            `member_data_json` LONGTEXT NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_registration_members_resident_code` (`resident_code`),
            UNIQUE KEY `uq_registration_members_household_order` (`household_id`, `member_order`),
            KEY `idx_registration_members_household_id` (`household_id`),
            KEY `idx_registration_members_record_year` (`record_year`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_residents` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `resident_code` VARCHAR(64) NOT NULL,
            `household_id` BIGINT UNSIGNED NOT NULL,
            `household_code` VARCHAR(64) NOT NULL,
            `record_year` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `source_type` VARCHAR(16) NOT NULL,
            `member_order` INT UNSIGNED NOT NULL DEFAULT 0,
            `full_name` VARCHAR(220) NOT NULL DEFAULT "",
            `relation_to_head` VARCHAR(120) NOT NULL DEFAULT "",
            `sex` VARCHAR(20) NOT NULL DEFAULT "",
            `age` VARCHAR(20) NOT NULL DEFAULT "",
            `zone` VARCHAR(80) NOT NULL DEFAULT "",
            `resident_data_json` LONGTEXT NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_registration_residents_code` (`resident_code`),
            KEY `idx_registration_residents_household_id` (`household_id`),
            KEY `idx_registration_residents_zone` (`zone`),
            KEY `idx_registration_residents_record_year` (`record_year`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_year_rollovers` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `source_year` SMALLINT UNSIGNED NOT NULL,
            `target_year` SMALLINT UNSIGNED NOT NULL,
            `status` VARCHAR(20) NOT NULL DEFAULT "completed",
            `source_household_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `created_household_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `skipped_household_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `completed_by_user_id` BIGINT UNSIGNED NULL,
            `completed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_registration_year_rollovers_target_year` (`target_year`),
            KEY `idx_registration_year_rollovers_source_year` (`source_year`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    reg_photo_bootstrap_table($pdo);

    reg_add_registration_year_columns($pdo);
    reg_add_household_version_column($pdo);
}

function reg_table_column_exists(PDO $pdo, string $tableName, string $columnName): bool
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
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);
    return (bool) $stmt->fetchColumn();
}

function reg_table_index_exists(PDO $pdo, string $tableName, string $indexName): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND INDEX_NAME = :index_name
         LIMIT 1'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'index_name' => $indexName,
    ]);
    return (bool) $stmt->fetchColumn();
}

function reg_add_column_if_missing(PDO $pdo, string $tableName, string $columnName, string $definitionSql): void
{
    if (reg_table_column_exists($pdo, $tableName, $columnName)) {
        return;
    }
    $pdo->exec(sprintf(
        'ALTER TABLE `%s` ADD COLUMN `%s` %s',
        $tableName,
        $columnName,
        $definitionSql
    ));
}

function reg_add_index_if_missing(PDO $pdo, string $tableName, string $indexName, string $indexSql): void
{
    if (reg_table_index_exists($pdo, $tableName, $indexName)) {
        return;
    }
    $pdo->exec(sprintf('ALTER TABLE `%s` ADD %s', $tableName, $indexSql));
}

function reg_add_household_version_column(PDO $pdo): void
{
    reg_add_column_if_missing(
        $pdo,
        'registration_households',
        'client_record_id',
        'VARCHAR(64) NULL DEFAULT NULL AFTER `household_code`'
    );
    reg_add_index_if_missing(
        $pdo,
        'registration_households',
        'uq_registration_households_client_record',
        'UNIQUE KEY `uq_registration_households_client_record` (`client_record_id`)'
    );
    reg_add_column_if_missing(
        $pdo,
        'registration_households',
        'row_version',
        'BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER `updated_by_user_id`'
    );
}

function reg_add_registration_year_columns(PDO $pdo): void
{
    reg_add_column_if_missing(
        $pdo,
        'registration_households',
        'record_year',
        'SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `household_code`'
    );
    reg_add_column_if_missing(
        $pdo,
        'registration_households',
        'rollover_source_household_code',
        'VARCHAR(64) NOT NULL DEFAULT "" AFTER `record_year`'
    );
    reg_add_index_if_missing(
        $pdo,
        'registration_households',
        'idx_registration_households_record_year',
        'KEY `idx_registration_households_record_year` (`record_year`)'
    );

    reg_add_column_if_missing(
        $pdo,
        'registration_members',
        'record_year',
        'SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `household_code`'
    );
    reg_add_index_if_missing(
        $pdo,
        'registration_members',
        'idx_registration_members_record_year',
        'KEY `idx_registration_members_record_year` (`record_year`)'
    );

    reg_add_column_if_missing(
        $pdo,
        'registration_residents',
        'record_year',
        'SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `household_code`'
    );
    reg_add_index_if_missing(
        $pdo,
        'registration_residents',
        'idx_registration_residents_record_year',
        'KEY `idx_registration_residents_record_year` (`record_year`)'
    );

    if (reg_table_column_exists($pdo, 'registration_households', 'record_year')) {
        $pdo->exec(
            'UPDATE `registration_households`
             SET `record_year` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(`household_code`, "-", 2), "-", -1) AS UNSIGNED)
             WHERE `record_year` = 0
               AND `household_code` REGEXP "^HH-[0-9]{4}-"'
        );
        $pdo->exec(
            'UPDATE `registration_households`
             SET `record_year` = YEAR(COALESCE(`updated_at`, `created_at`))
             WHERE `record_year` = 0'
        );
    }

    if (reg_table_column_exists($pdo, 'registration_members', 'record_year')) {
        $pdo->exec(
            'UPDATE `registration_members`
             SET `record_year` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(`household_code`, "-", 2), "-", -1) AS UNSIGNED)
             WHERE `record_year` = 0
               AND `household_code` REGEXP "^HH-[0-9]{4}-"'
        );
        $pdo->exec(
            'UPDATE `registration_members`
             SET `record_year` = YEAR(COALESCE(`updated_at`, `created_at`))
             WHERE `record_year` = 0'
        );
    }

    if (reg_table_column_exists($pdo, 'registration_residents', 'record_year')) {
        $pdo->exec(
            'UPDATE `registration_residents`
             SET `record_year` = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(`household_code`, "-", 2), "-", -1) AS UNSIGNED)
             WHERE `record_year` = 0
               AND `household_code` REGEXP "^HH-[0-9]{4}-"'
        );
        $pdo->exec(
            'UPDATE `registration_residents`
             SET `record_year` = YEAR(COALESCE(`updated_at`, `created_at`))
             WHERE `record_year` = 0'
        );
    }
}

/**
 * @return array<string, string>
 */
function reg_required_sync_procedures(): array
{
    return [
        'sp_sync_registration_household' => '2026-02-25_create_sp_sync_registration_household.sql',
        'sp_sync_registration_member' => '2026-02-25_create_sp_sync_registration_member.sql',
    ];
}

/**
 * @param array<string, mixed> $triggerRow
 */
function reg_legacy_trigger_label(array $triggerRow): string
{
    return trim(
        (string) ($triggerRow['trigger_name'] ?? '')
        . ' on '
        . (string) ($triggerRow['table_name'] ?? '')
        . ' ('
        . trim((string) ($triggerRow['action_timing'] ?? ''))
        . ' '
        . trim((string) ($triggerRow['event_manipulation'] ?? ''))
        . ')'
    );
}

/**
 * @return array<int, array<string, mixed>>
 */
function reg_legacy_trigger_rows(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT `TRIGGER_NAME`, `EVENT_OBJECT_TABLE`, `ACTION_TIMING`, `EVENT_MANIPULATION`, `ACTION_STATEMENT`
         FROM `information_schema`.`TRIGGERS`
         WHERE `TRIGGER_SCHEMA` = DATABASE()
         ORDER BY `EVENT_OBJECT_TABLE` ASC, `TRIGGER_NAME` ASC'
    );
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    $items = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $triggerName = trim((string) ($row['TRIGGER_NAME'] ?? ''));
        if ($triggerName === '' || preg_match('/^[A-Za-z0-9_]+$/', $triggerName) !== 1) {
            continue;
        }

        $actionStatement = strtolower(trim((string) ($row['ACTION_STATEMENT'] ?? '')));
        $matchedProcedures = [];
        foreach (array_keys(reg_required_sync_procedures()) as $procedureName) {
            if (strpos($actionStatement, strtolower($procedureName)) !== false) {
                $matchedProcedures[] = $procedureName;
            }
        }

        if ($matchedProcedures === []) {
            continue;
        }

        $triggerRow = [
            'trigger_name' => $triggerName,
            'table_name' => trim((string) ($row['EVENT_OBJECT_TABLE'] ?? '')),
            'action_timing' => strtoupper(trim((string) ($row['ACTION_TIMING'] ?? ''))),
            'event_manipulation' => strtoupper(trim((string) ($row['EVENT_MANIPULATION'] ?? ''))),
            'action_statement' => trim((string) ($row['ACTION_STATEMENT'] ?? '')),
            'matched_procedures' => $matchedProcedures,
        ];
        $triggerRow['trigger_label'] = reg_legacy_trigger_label($triggerRow);
        $items[] = $triggerRow;
    }

    return $items;
}

/**
 * @return array{removed:array<int, string>,removed_count:int}
 */
function reg_remove_legacy_sync_triggers(PDO $pdo): array
{
    $removed = [];

    foreach (reg_legacy_trigger_rows($pdo) as $triggerRow) {
        $triggerName = trim((string) ($triggerRow['trigger_name'] ?? ''));
        if ($triggerName === '') {
            continue;
        }

        try {
            $pdo->exec('DROP TRIGGER IF EXISTS ' . reg_quote_identifier($triggerName));
        } catch (Throwable $exception) {
            throw new RuntimeException(
                'Unable to remove legacy sync trigger ' . $triggerName . '. ' . $exception->getMessage(),
                0,
                $exception
            );
        }

        $removedLabel = trim((string) ($triggerRow['trigger_label'] ?? ''));
        $removed[] = $removedLabel !== '' ? $removedLabel : $triggerName;
    }

    $removed = array_values(array_unique(array_filter(array_map('trim', $removed))));

    return [
        'removed' => $removed,
        'removed_count' => count($removed),
    ];
}

function reg_procedure_exists(PDO $pdo, string $procedureName): bool
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

function reg_migration_path(string $fileName): string
{
    return __DIR__ . '/database/migrations/' . $fileName;
}

function reg_execute_migration_sql(PDO $pdo, string $migrationFileName): void
{
    $path = reg_migration_path($migrationFileName);
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

function reg_ensure_sync_procedures(PDO $pdo): void
{
    if (!auth_sync_routines_enabled()) {
        reg_remove_legacy_sync_triggers($pdo);
        return;
    }

    foreach (reg_required_sync_procedures() as $procedureName => $migrationFileName) {
        if (reg_procedure_exists($pdo, $procedureName)) {
            continue;
        }

        reg_execute_migration_sql($pdo, $migrationFileName);

        if (!reg_procedure_exists($pdo, $procedureName)) {
            throw new RuntimeException('Failed to install required database routine: ' . $procedureName . '.');
        }
    }
}

function reg_friendly_server_error(Throwable $exception): string
{
    $rawMessage = trim($exception->getMessage());
    $message = strtolower($rawMessage);
    if ($message === '') {
        return 'Unable to process registration request right now.';
    }

    if (
        (strpos($message, 'procedure') !== false && strpos($message, 'does not exist') !== false)
        || strpos($message, 'create routine command denied') !== false
        || strpos($message, 'unable to install required database routine') !== false
        || strpos($message, 'failed to install required database routine') !== false
    ) {
        return auth_sync_routines_enabled()
            ? 'Registration sync failed: database sync routines are missing or not allowed for this database user.'
            : 'Registration sync failed: legacy database triggers are calling missing sync routines. Remove the old triggers from the database, or enable AUTH_ENABLE_SYNC_ROUTINES=1 on a server that allows routines.';
    }

    if (
        strpos($message, 'unable to remove legacy sync trigger') !== false
        || strpos($message, 'trigger command denied') !== false
        || strpos($message, 'drop trigger command denied') !== false
    ) {
        return 'Registration sync failed: legacy database triggers could not be removed with the current database user. Remove them in phpMyAdmin, or use a database user that can drop triggers.';
    }

    return 'Registration sync failed: ' . $rawMessage;
}

const REG_SCHEMA_MAINTENANCE_SESSION_KEY = '__registration_schema_maintenance_v2_at';
const REG_SCHEMA_MAINTENANCE_TTL_SECONDS = 60 * 5;

function reg_should_run_schema_maintenance(bool $force = false): bool
{
    if ($force) {
        return true;
    }

    auth_start_session();
    $lastCheckedAt = (int) ($_SESSION[REG_SCHEMA_MAINTENANCE_SESSION_KEY] ?? 0);
    if ($lastCheckedAt <= 0) {
        return true;
    }

    return (time() - $lastCheckedAt) >= REG_SCHEMA_MAINTENANCE_TTL_SECONDS;
}

function reg_mark_schema_maintenance_complete(): void
{
    auth_start_session();
    $_SESSION[REG_SCHEMA_MAINTENANCE_SESSION_KEY] = time();
}

function reg_total_households(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM `registration_households`')->fetchColumn();
}

function reg_household_exists(PDO $pdo, string $householdCode): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM `registration_households` WHERE `household_code` = :household_code LIMIT 1'
    );
    $stmt->execute(['household_code' => $householdCode]);
    return (bool) $stmt->fetchColumn();
}

function reg_household_year_from_code(string $householdCode): string
{
    if (preg_match('/^HH-(\d{4})-\d+$/i', trim($householdCode), $matches) === 1) {
        return (string) ($matches[1] ?? '');
    }
    return '';
}

function reg_household_record_year(string $householdCode): int
{
    $year = (int) reg_household_year_from_code($householdCode);
    return reg_valid_record_year($year) ? $year : 0;
}

function reg_parse_year_value(mixed $value): int
{
    if (!is_numeric($value)) {
        return 0;
    }
    $year = (int) $value;
    return reg_valid_record_year($year) ? $year : 0;
}

function reg_duplicate_key_part(mixed $value, int $maxLength = 220): string
{
    $text = reg_text($value, $maxLength);
    if ($text === '') {
        return '';
    }

    $text = strtolower($text);
    $text = preg_replace('/\s+/u', ' ', $text);
    if (!is_string($text)) {
        return strtolower(reg_text($value, $maxLength));
    }

    return trim($text);
}

/**
 * @param array<string, mixed> $record
 * @param array<string, mixed> $head
 */
function reg_household_head_name_key(array $record, array $head = []): string
{
    $headName = reg_text($record['head_name'] ?? '', 180);
    if ($headName === '') {
        $headName = trim(implode(' ', array_filter([
            reg_text($head['first_name'] ?? '', 80),
            reg_text($head['middle_name'] ?? '', 80),
            reg_text($head['last_name'] ?? '', 80),
            reg_text($head['extension_name'] ?? '', 80),
        ])));
    }

    return reg_duplicate_key_part($headName, 220);
}

/**
 * @param array<string, mixed> $record
 * @param array<string, mixed> $head
 */
function reg_household_address_key(array $record, array $head = []): string
{
    return reg_duplicate_key_part($record['address'] ?? ($head['address'] ?? ''), 220);
}

/**
 * @param array<string, mixed> $record
 */
function reg_household_record_year_from_record(array $record): int
{
    $recordYear = reg_parse_year_value($record['record_year'] ?? 0);
    if (reg_valid_record_year($recordYear)) {
        return $recordYear;
    }

    return reg_household_record_year(reg_text($record['household_id'] ?? '', 64));
}

function reg_household_code_for_year(string $householdCode, int $targetYear): string
{
    if (!reg_valid_record_year($targetYear)) {
        return '';
    }
    if (preg_match('/^HH-\d{4}-(\d+)$/i', trim($householdCode), $matches) !== 1) {
        return '';
    }
    $sequence = reg_text($matches[1] ?? '', 40);
    return $sequence === '' ? '' : sprintf('HH-%04d-%s', $targetYear, $sequence);
}

function reg_next_household_code(PDO $pdo, int $recordYear): string
{
    if (!reg_valid_record_year($recordYear)) {
        throw new InvalidArgumentException('A valid household record year is required.');
    }

    $stmt = $pdo->prepare(
        'SELECT MAX(CAST(SUBSTRING_INDEX(`household_code`, "-", -1) AS UNSIGNED))
         FROM `registration_households`
         WHERE `record_year` = :record_year OR `household_code` LIKE :year_prefix'
    );
    $stmt->execute([
        'record_year' => $recordYear,
        'year_prefix' => sprintf('HH-%04d-%%', $recordYear),
    ]);
    $nextSequence = max(0, (int) $stmt->fetchColumn()) + 1;
    return sprintf('HH-%04d-%03d', $recordYear, $nextSequence);
}

function reg_identity_part(mixed $value): string
{
    $text = reg_text($value, 120);
    $text = strtolower($text);
    $text = preg_replace('/\s+/', ' ', $text);
    if ($text === null) {
        $text = strtolower(reg_text($value, 120));
    }
    return trim($text);
}

function reg_identity_birthday_part(mixed $value): string
{
    $raw = reg_text($value, 120);
    if ($raw === '') {
        return '';
    }

    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }

    $formats = [
        '!Y-m-d',
        '!m/d/Y',
        '!m-d-Y',
        '!n/j/Y',
        '!n-j-Y',
        '!m/d/y',
        '!m-d-y',
    ];

    foreach ($formats as $format) {
        $date = DateTimeImmutable::createFromFormat($format, $raw);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            $date instanceof DateTimeImmutable
            && is_array($errors)
            && (int) ($errors['warning_count'] ?? 0) === 0
            && (int) ($errors['error_count'] ?? 0) === 0
        ) {
            return $date->format('Y-m-d');
        }
    }

    $timestamp = strtotime($raw);
    if ($timestamp !== false) {
        return gmdate('Y-m-d', $timestamp);
    }

    return reg_identity_part($raw);
}

/**
 * @param array<string, mixed> $head
 */
function reg_household_identity_core(array $head): string
{
    $firstName = reg_identity_part($head['first_name'] ?? '');
    $lastName = reg_identity_part($head['last_name'] ?? '');
    $birthday = reg_identity_birthday_part($head['birthday'] ?? '');
    if ($firstName === '' || $lastName === '' || $birthday === '') {
        return '';
    }

    return implode('|', [$firstName, $lastName, $birthday]);
}

/**
 * @param array<string, mixed> $head
 */
function reg_household_identity_full(array $head): string
{
    $firstName = reg_identity_part($head['first_name'] ?? '');
    $lastName = reg_identity_part($head['last_name'] ?? '');
    $birthday = reg_identity_birthday_part($head['birthday'] ?? '');
    if ($firstName === '' || $lastName === '' || $birthday === '') {
        return '';
    }

    $middleName = reg_identity_part($head['middle_name'] ?? '');
    $extensionName = reg_identity_part($head['extension_name'] ?? '');
    return implode('|', [$firstName, $middleName, $lastName, $extensionName, $birthday]);
}

/**
 * @param array<int, string> $values
 * @return array<int, string>
 */
function reg_unique_text_values(array $values): array
{
    $seen = [];
    $unique = [];

    foreach ($values as $value) {
        if (!is_string($value) || $value === '') {
            continue;
        }
        if (isset($seen[$value])) {
            continue;
        }
        $seen[$value] = true;
        $unique[] = $value;
    }

    return $unique;
}

/**
 * @param array<string, mixed> $record
 */
function reg_household_duplicate_keys(array $record): array
{
    $head = is_array($record['head'] ?? null) ? $record['head'] : [];
    $identityCore = reg_household_identity_core($head);
    $identityFull = reg_household_identity_full($head);
    $headName = reg_household_head_name_key($record, $head);
    $zone = reg_duplicate_key_part(
        reg_normalize_zone_text($record['zone'] ?? ($head['zone'] ?? '')),
        80
    );
    $address = reg_household_address_key($record, $head);
    $firstName = reg_identity_part($head['first_name'] ?? '');
    $lastName = reg_identity_part($head['last_name'] ?? '');

    $keys = [];

    if ($identityCore !== '') {
        $keys[] = 'identity_core|' . $identityCore;

        if ($identityFull !== '' && $identityFull !== $identityCore) {
            $keys[] = 'identity_full|' . $identityFull;
        }

        if ($address !== '') {
            $keys[] = 'identity_address|' . $identityCore . '|' . $address . '|' . $zone;
        } elseif ($zone !== '') {
            $keys[] = 'identity_zone|' . $identityCore . '|' . $zone;
        }
    }

    if ($firstName !== '' && $lastName !== '') {
        if ($address !== '') {
            $keys[] = 'name_address|' . $firstName . '|' . $lastName . '|' . $address . '|' . $zone;
        }
        if ($zone !== '') {
            $keys[] = 'name_zone|' . $firstName . '|' . $lastName . '|' . $zone;
        }
    }

    if ($headName !== '' && $address !== '') {
        $keys[] = 'head_address|' . $headName . '|' . $address . '|' . $zone;
    }

    if ($headName !== '' && $zone !== '') {
        $keys[] = 'head_zone|' . $headName . '|' . $zone;
    }

    return reg_unique_text_values($keys);
}

/**
 * @param array<string, mixed> $record
 */
function reg_household_duplicate_key(array $record): string
{
    $keys = reg_household_duplicate_keys($record);
    return $keys[0] ?? '';
}

/**
 * @param array<string, mixed> $record
 */
function reg_household_duplicate_lock_name(array $record): string
{
    $recordYear = reg_household_record_year_from_record($record);
    $duplicateKey = reg_household_duplicate_key($record);
    if (!reg_valid_record_year($recordYear) || $duplicateKey === '') {
        return '';
    }

    return sprintf('reg_hh_dup_%04d_%s', $recordYear, sha1($duplicateKey));
}

function reg_acquire_advisory_lock(PDO $pdo, string $lockName, int $timeoutSeconds = 10): bool
{
    if ($lockName === '') {
        return false;
    }

    try {
        $stmt = $pdo->prepare('SELECT GET_LOCK(:lock_name, :timeout_seconds)');
        $stmt->bindValue('lock_name', $lockName, PDO::PARAM_STR);
        $stmt->bindValue('timeout_seconds', $timeoutSeconds, PDO::PARAM_INT);
        $stmt->execute();
        return (string) $stmt->fetchColumn() === '1';
    } catch (Throwable) {
        return false;
    }
}

function reg_release_advisory_lock(PDO $pdo, string $lockName): void
{
    if ($lockName === '') {
        return;
    }

    try {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(:lock_name)');
        $stmt->execute(['lock_name' => $lockName]);
    } catch (Throwable) {
        // Ignore release failures so the main response can continue.
    }
}

/**
 * @param array<string, mixed> $duplicate
 */
function reg_duplicate_household_message(array $duplicate): string
{
    $duplicateYear = reg_text($duplicate['year'] ?? '', 10);
    return $duplicateYear !== ''
        ? "Household already exists for {$duplicateYear}. Duplicate entries are not allowed."
        : 'Household already exists. Duplicate entries are not allowed.';
}

/**
 * @param array<string, mixed> $duplicate
 * @return array<string, mixed>
 */
function reg_duplicate_household_payload(array $duplicate): array
{
    return [
        'success' => false,
        'code' => 'duplicate_household',
        'error' => reg_duplicate_household_message($duplicate),
        'duplicate' => $duplicate,
    ];
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function reg_duplicate_record_from_household_row(array $row): array
{
    $rowRecord = reg_json_decode_assoc((string) ($row['record_data_json'] ?? ''));
    $existingHead = reg_json_decode_assoc((string) ($row['head_data_json'] ?? ''));
    if (!is_array($rowRecord)) {
        $rowRecord = [];
    }
    if (!isset($rowRecord['head']) || !is_array($rowRecord['head'])) {
        $rowRecord['head'] = $existingHead;
    }
    if (!array_key_exists('head_name', $rowRecord)) {
        $rowRecord['head_name'] = (string) ($row['head_name'] ?? '');
    }
    if (!array_key_exists('zone', $rowRecord)) {
        $rowRecord['zone'] = reg_normalize_zone_text($row['zone'] ?? ($existingHead['zone'] ?? ''));
    }
    if (!array_key_exists('address', $rowRecord) && array_key_exists('address', $existingHead)) {
        $rowRecord['address'] = $existingHead['address'];
    }

    return $rowRecord;
}

/**
 * @param array<string, mixed> $record
 * @return array<string, mixed>|null
 */
function reg_find_duplicate_household(PDO $pdo, array $record, string $excludeHouseholdCode = ''): ?array
{
    $duplicateKeys = reg_household_duplicate_keys($record);
    if (count($duplicateKeys) === 0) {
        return null;
    }

    $targetYear = reg_household_record_year_from_record($record);
    if (!reg_valid_record_year($targetYear)) {
        return null;
    }

    $sql = 'SELECT `household_code`, `record_year`, `head_name`, `zone`, `head_data_json`, `record_data_json`, `created_at`, `updated_at`
            FROM `registration_households`';
    $params = [];
    $where = [];
    if ($excludeHouseholdCode !== '') {
        $where[] = '`household_code` <> :exclude_household_code';
        $params['exclude_household_code'] = $excludeHouseholdCode;
    }
    $where[] = '(`record_year` = :record_year OR (`record_year` = 0 AND `household_code` LIKE :year_prefix))';
    $params['record_year'] = $targetYear;
    $params['year_prefix'] = sprintf('HH-%04d-%%', $targetYear);
    if (count($where) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $rowRecord = reg_duplicate_record_from_household_row($row);
        $existingDuplicateKeys = reg_household_duplicate_keys($rowRecord);
        if (count($existingDuplicateKeys) === 0) {
            continue;
        }
        if (count(array_intersect($duplicateKeys, $existingDuplicateKeys)) === 0) {
            continue;
        }

        return [
            'household_id' => (string) ($row['household_code'] ?? ''),
            'head_name' => (string) ($row['head_name'] ?? ''),
            'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
            'year' => (string) (reg_parse_year_value($row['record_year'] ?? 0) ?: $targetYear),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    return null;
}

/**
 * @param array<string, mixed> $authUser
 * @param array<string, mixed> $metadata
 */
function reg_audit_log(
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
        'action_key' => reg_text($actionKey, 100),
        'action_type' => reg_text($actionType, 40),
        'module_name' => 'Registration',
        'record_type' => reg_text($recordType, 80),
        'record_id' => reg_text($recordId, 120),
        'details' => reg_text($details, 255),
        'metadata' => $metadata,
    ]);
}

/**
 * @param array<string, mixed> $payload
 * @return array<string, mixed>
 */
function reg_idempotent_sync_result(PDO $pdo, array $payload, string $syncedAt): array
{
    return [
        'household_id' => (string) ($payload['household_id'] ?? ''),
        'record_year' => (int) ($payload['record_year'] ?? 0),
        'synced_at' => $syncedAt,
        'updated_at' => (string) ($payload['updated_at'] ?? ''),
        'row_version' => max(1, (int) ($payload['row_version'] ?? 1)),
        'total_records' => reg_total_households($pdo),
        'record' => is_array($payload['record'] ?? null) ? $payload['record'] : [],
        'idempotent' => true,
    ];
}

function reg_canonical_sync_value(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }
    $normalized = [];
    foreach ($value as $key => $item) {
        $normalized[$key] = reg_canonical_sync_value($item);
    }
    $isList = count($normalized) === 0
        || array_keys($normalized) === range(0, count($normalized) - 1);
    if (!$isList) {
        ksort($normalized, SORT_STRING);
    }
    return $normalized;
}

/** @param array<string, mixed> $record */
function reg_household_sync_fingerprint(array $record): string
{
    $content = [
        'client_record_id' => reg_text($record['client_record_id'] ?? '', 64),
        'source' => reg_text($record['source'] ?? '', 80),
        'photo_schema_version' => (int) ($record['photo_schema_version'] ?? 0),
        'household_photo_id' => reg_photo_normalize_id($record['household_photo_id'] ?? ''),
        'head' => is_array($record['head'] ?? null) ? $record['head'] : [],
        'members' => is_array($record['members'] ?? null) ? $record['members'] : [],
        'head_name' => reg_text($record['head_name'] ?? '', 180),
        'zone' => reg_normalize_zone_text($record['zone'] ?? ''),
        'member_count' => (int) ($record['member_count'] ?? 0),
        'record_year' => (int) ($record['record_year'] ?? 0),
        'rollover_source_household_id' => reg_text($record['rollover_source_household_id'] ?? '', 64),
    ];
    return hash('sha256', reg_json_encode(reg_canonical_sync_value($content)));
}

/**
 * @param array<string, mixed> $record
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function reg_upsert_household(PDO $pdo, array $record, array $authUser): array
{
    $householdCode = reg_text($record['household_id'] ?? '', 64);
    if ($householdCode === '') {
        throw new InvalidArgumentException('household_id is required.');
    }
    $recordYear = reg_household_record_year($householdCode);
    if (!reg_valid_record_year($recordYear)) {
        throw new InvalidArgumentException('household_id must contain a valid record year.');
    }
    $mode = strtolower(reg_text($record['mode'] ?? 'update', 20));
    if (!in_array($mode, ['create', 'update', 'rollover'], true)) {
        $mode = 'update';
    }
    $clientRecordId = reg_text($record['client_record_id'] ?? '', 64);

    $head = is_array($record['head'] ?? null) ? $record['head'] : [];
    $head = reg_normalize_person_photo_reference(reg_normalize_person_text_fields($head));
    $headContact = reg_normalize_contact_number($head['contact'] ?? '');
    if (!preg_match('/^09\d{9}$/', $headContact)) {
        throw new InvalidArgumentException('Household head contact number must contain a valid 11-digit Philippine mobile number.');
    }
    $head['contact'] = $headContact;

    $members = [];
    foreach (reg_normalize_members($record['members'] ?? []) as $memberRow) {
        $member = reg_normalize_person_photo_reference(reg_normalize_person_text_fields($memberRow));
        $clientMemberId = reg_optional_client_member_id($member['client_member_id'] ?? '');
        if ($clientMemberId === '') {
            unset($member['client_member_id']);
        } else {
            $member['client_member_id'] = $clientMemberId;
        }
        $memberContact = reg_normalize_contact_number($member['contact'] ?? '');
        if ($memberContact !== '' && !preg_match('/^09\d{9}$/', $memberContact)) {
            throw new InvalidArgumentException('Member contact number must contain a valid 11-digit Philippine mobile number when provided.');
        }
        $member['contact'] = $memberContact;
        $members[] = $member;
    }
    if (count($members) === 0) {
        throw new InvalidArgumentException('At least one household member is required.');
    }
    if (count($members) > REG_MAX_HOUSEHOLD_MEMBERS) {
        throw new InvalidArgumentException('A household cannot contain more than 100 members.');
    }

    $headName = reg_text(reg_title_case_text($record['head_name'] ?? ''), 180);
    if ($headName === '') {
        $first = reg_text($head['first_name'] ?? '', 80);
        $last = reg_text($head['last_name'] ?? '', 80);
        $headName = trim($first . ' ' . $last);
    }
    if ($headName === '') {
        $headName = 'Unnamed household head';
    }
    $zone = reg_normalize_zone_text($record['zone'] ?? ($head['zone'] ?? ''));
    if ($zone === '') {
        throw new InvalidArgumentException('Zone is required.');
    }
    if (preg_match('/^Zone [1-7]$/', $zone) !== 1) {
        throw new InvalidArgumentException('Zone must be between Zone 1 and Zone 7.');
    }
    $head['zone'] = $zone;

    foreach ($members as $index => $member) {
        if (!is_array($member)) {
            continue;
        }
        $memberZone = reg_normalize_zone_text($member['zone'] ?? $zone);
        if ($memberZone === '') {
            $memberZone = $zone;
        }
        if (preg_match('/^Zone [1-7]$/', $memberZone) !== 1) {
            throw new InvalidArgumentException('Member zone must be between Zone 1 and Zone 7.');
        }
        $member['zone'] = $memberZone;
        $members[$index] = $member;
    }
    $source = reg_text($record['source'] ?? 'registration-module', 80);
    $photoSchemaAware = (int) ($record['photo_schema_version'] ?? 0) >= 1;
    $householdPhotoId = reg_photo_normalize_id($record['household_photo_id'] ?? '');
    $rolloverSourceHouseholdCode = reg_text(
        $record['rolled_over_from_household_id'] ?? ($record['rollover_source_household_code'] ?? ''),
        64
    );
    $memberCount = max(1, count($members) + 1);
    $actorUserId = (int) ($authUser['id'] ?? 0);
    $syncedAt = gmdate('c');

    $recordForStore = [
        'household_id' => $householdCode,
        'client_record_id' => $clientRecordId,
        'mode' => $mode,
        'source' => $source,
        'photo_schema_version' => 1,
        'household_photo_id' => $householdPhotoId,
        'head' => $head,
        'members' => $members,
        'head_name' => $headName,
        'zone' => $zone,
        'member_count' => $memberCount,
        'record_year' => $recordYear,
        'rollover_source_household_id' => $rolloverSourceHouseholdCode,
        'updated_at' => $syncedAt,
        'server_synced_at' => $syncedAt,
    ];
    $duplicateLockName = reg_household_duplicate_lock_name($recordForStore);
    $codeLockName = $mode === 'create' ? sprintf('reg_hh_code_%04d', $recordYear) : '';

    $startedTransaction = false;
    $codeLockAcquired = false;
    $obsoletePhotoStorageKeys = [];
    try {
        reg_acquire_advisory_lock($pdo, $duplicateLockName);
        if ($codeLockName !== '') {
            $codeLockAcquired = reg_acquire_advisory_lock($pdo, $codeLockName);
            if (!$codeLockAcquired) {
                throw new RuntimeException('Unable to reserve a household ID right now. Please retry.');
            }
        }

        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $startedTransaction = true;
        }

        if ($mode === 'create' && $clientRecordId !== '') {
            $clientRecordStmt = $pdo->prepare(
                'SELECT `household_code`, `record_data_json`, `row_version`
                 FROM `registration_households`
                 WHERE `client_record_id` = :client_record_id
                 LIMIT 1 FOR UPDATE'
            );
            $clientRecordStmt->execute(['client_record_id' => $clientRecordId]);
            $clientRecordRow = $clientRecordStmt->fetch(PDO::FETCH_ASSOC);
            $clientRecordRow = is_array($clientRecordRow) ? $clientRecordRow : [];
            $clientRecordHouseholdCode = reg_text($clientRecordRow['household_code'] ?? '', 64);
            if ($clientRecordHouseholdCode !== '') {
                $storedReplayRecord = reg_json_decode_assoc((string) ($clientRecordRow['record_data_json'] ?? ''));
                if (!hash_equals(
                    reg_household_sync_fingerprint($storedReplayRecord),
                    reg_household_sync_fingerprint($recordForStore)
                )) {
                    throw new RegHouseholdConflictException(
                        [
                            'household_id' => $clientRecordHouseholdCode,
                            'row_version' => max(1, (int) ($clientRecordRow['row_version'] ?? 1)),
                            'state' => 'create_replay_changed',
                        ],
                        'This offline household was already synced, but its queued copy contains newer changes.'
                    );
                }
                $existingPayload = reg_get_household($pdo, $clientRecordHouseholdCode);
                if (!is_array($existingPayload)) {
                    throw new RuntimeException('Unable to reload the existing household after sync.');
                }
                if ($startedTransaction && $pdo->inTransaction()) {
                    $pdo->commit();
                }
                return reg_idempotent_sync_result($pdo, $existingPayload, $syncedAt);
            }
        }

        $findStmt = $pdo->prepare(
            'SELECT `id`, `household_code`, `client_record_id`, `record_year`, `head_name`, `zone`, `row_version`, `updated_at`,
                    `head_data_json`, `members_data_json`, `record_data_json`
             FROM `registration_households`
             WHERE `household_code` = :household_code
             LIMIT 1 FOR UPDATE'
        );
        $findStmt->execute(['household_code' => $householdCode]);
        $existing = $findStmt->fetch(PDO::FETCH_ASSOC);
        $householdDbId = is_array($existing) ? (int) ($existing['id'] ?? 0) : 0;
        if ($mode === 'create' && $householdDbId > 0) {
            $householdCode = reg_next_household_code($pdo, $recordYear);
            $recordForStore['household_id'] = $householdCode;
            $findStmt->execute(['household_code' => $householdCode]);
            $existing = $findStmt->fetch(PDO::FETCH_ASSOC);
            $householdDbId = is_array($existing) ? (int) ($existing['id'] ?? 0) : 0;
        }

        if ($mode === 'update' && $householdDbId <= 0) {
            throw new RegHouseholdConflictException([
                'household_id' => $householdCode,
                'state' => 'missing',
            ], 'This household no longer exists on the server. Reload the household list before editing again.');
        }
        if ($mode === 'rollover' && $householdDbId > 0) {
            throw new RegHouseholdConflictException([
                'household_id' => $householdCode,
                'state' => 'already_exists',
            ], 'The rollover target household already exists.');
        }

        $baseVersion = max(0, (int) ($record['base_version'] ?? 0));
        $currentVersion = is_array($existing) ? max(1, (int) ($existing['row_version'] ?? 1)) : 0;
        $currentClientRecordId = is_array($existing) ? reg_text($existing['client_record_id'] ?? '', 64) : '';
        $currentUpdatedAt = is_array($existing) ? reg_text($existing['updated_at'] ?? '', 40) : '';
        if ($mode === 'update' && $householdDbId > 0) {
            if ($clientRecordId === '' && $currentClientRecordId !== '') {
                $clientRecordId = $currentClientRecordId;
                $recordForStore['client_record_id'] = $clientRecordId;
            }
        }

        // Preserve photo references when an older cached client edits a record
        // created by the photo-aware app. This prevents silent photo loss while
        // the service worker/browser updates to the current scripts.
        if (!$photoSchemaAware && $householdDbId > 0 && is_array($existing)) {
            $existingRecord = reg_json_decode_assoc((string) ($existing['record_data_json'] ?? ''));
            $existingHead = reg_json_decode_assoc((string) ($existing['head_data_json'] ?? ''));
            $existingMembers = reg_normalize_members(
                reg_json_decode_assoc((string) ($existing['members_data_json'] ?? ''))
            );

            $existingHouseholdPhotoId = reg_photo_normalize_id($existingRecord['household_photo_id'] ?? '');
            if ($householdPhotoId === '' && $existingHouseholdPhotoId !== '') {
                $householdPhotoId = $existingHouseholdPhotoId;
            }
            $existingHeadPhotoId = reg_photo_normalize_id($existingHead['profile_photo_id'] ?? '');
            if (reg_photo_normalize_id($head['profile_photo_id'] ?? '') === '' && $existingHeadPhotoId !== '') {
                $head['profile_photo_id'] = $existingHeadPhotoId;
            }

            $existingMembersByClientId = [];
            $existingMembersByIdentity = [];
            foreach ($existingMembers as $existingIndex => $existingMember) {
                if (!is_array($existingMember)) continue;
                $clientMemberId = reg_optional_client_member_id($existingMember['client_member_id'] ?? '');
                if ($clientMemberId !== '') $existingMembersByClientId[$clientMemberId] = $existingMember;
                $identityKey = reg_photo_person_match_key($existingMember);
                if ($identityKey !== '') $existingMembersByIdentity[$identityKey] = $existingMember;
                $existingMembers[$existingIndex] = $existingMember;
            }
            foreach ($members as $memberIndex => $member) {
                if (!is_array($member)) continue;
                if (reg_photo_normalize_id($member['profile_photo_id'] ?? '') !== '') continue;
                $matchedMember = null;
                $clientMemberId = reg_optional_client_member_id($member['client_member_id'] ?? '');
                if ($clientMemberId !== '' && isset($existingMembersByClientId[$clientMemberId])) {
                    $matchedMember = $existingMembersByClientId[$clientMemberId];
                } else {
                    $identityKey = reg_photo_person_match_key($member);
                    if ($identityKey !== '' && isset($existingMembersByIdentity[$identityKey])) {
                        $matchedMember = $existingMembersByIdentity[$identityKey];
                    }
                }
                if (!is_array($matchedMember)) continue;
                $matchedPhotoId = reg_photo_normalize_id($matchedMember['profile_photo_id'] ?? '');
                if ($matchedPhotoId !== '') $member['profile_photo_id'] = $matchedPhotoId;
                $matchedClientMemberId = reg_optional_client_member_id($matchedMember['client_member_id'] ?? '');
                if ($clientMemberId === '' && $matchedClientMemberId !== '') {
                    $member['client_member_id'] = $matchedClientMemberId;
                }
                $members[$memberIndex] = $member;
            }

            $recordForStore['household_photo_id'] = $householdPhotoId;
            $recordForStore['head'] = $head;
            $recordForStore['members'] = $members;
        }

        $photoReferences = [];
        if ($householdPhotoId !== '') {
            $photoReferences[$householdPhotoId] = 'household';
        }
        $headPhotoId = reg_photo_normalize_id($head['profile_photo_id'] ?? '');
        if ($headPhotoId !== '') {
            $photoReferences[$headPhotoId] = 'head';
        }
        foreach ($members as $member) {
            if (!is_array($member)) continue;
            $memberPhotoId = reg_photo_normalize_id($member['profile_photo_id'] ?? '');
            if ($memberPhotoId !== '') {
                $photoReferences[$memberPhotoId] = 'member';
            }
        }
        reg_photo_attach_references($pdo, $photoReferences, $householdCode, $actorUserId);

        $duplicate = reg_find_duplicate_household($pdo, $recordForStore, $householdCode);
        if (is_array($duplicate)) {
            throw new RegDuplicateHouseholdException(
                $duplicate,
                reg_duplicate_household_message($duplicate)
            );
        }

        $targetClientRecordId = $clientRecordId !== '' ? $clientRecordId : ($currentClientRecordId !== '' ? $currentClientRecordId : null);

        if ($householdDbId > 0) {
            $updateStmt = $pdo->prepare(
                'UPDATE `registration_households`
                 SET `record_year` = :record_year,
                     `client_record_id` = :client_record_id,
                     `rollover_source_household_code` = :rollover_source_household_code,
                     `source` = :source,
                     `head_name` = :head_name,
                     `zone` = :zone,
                     `member_count` = :member_count,
                     `head_data_json` = :head_data_json,
                     `members_data_json` = :members_data_json,
                     `record_data_json` = :record_data_json,
                     `updated_by_user_id` = :updated_by_user_id,
                     `row_version` = `row_version` + 1,
                     `updated_at` = CURRENT_TIMESTAMP
                 WHERE `id` = :id LIMIT 1'
            );
            $updateStmt->execute([
                'record_year' => $recordYear,
                'client_record_id' => $targetClientRecordId,
                'rollover_source_household_code' => $rolloverSourceHouseholdCode,
                'source' => $source,
                'head_name' => $headName,
                'zone' => $zone,
                'member_count' => $memberCount,
                'head_data_json' => reg_json_encode($head),
                'members_data_json' => reg_json_encode($members),
                'record_data_json' => reg_json_encode($recordForStore),
                'updated_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
                'id' => $householdDbId,
            ]);
        } else {
            $insertStmt = $pdo->prepare(
                'INSERT INTO `registration_households`
                 (`household_code`, `client_record_id`, `record_year`, `rollover_source_household_code`, `source`, `head_name`, `zone`, `member_count`,
                   `head_data_json`, `members_data_json`, `record_data_json`, `created_by_user_id`, `updated_by_user_id`)
                 VALUES
                 (:household_code, :client_record_id, :record_year, :rollover_source_household_code, :source, :head_name, :zone, :member_count,
                   :head_data_json, :members_data_json, :record_data_json, :created_by_user_id, :updated_by_user_id)'
            );
            $insertStmt->execute([
                'household_code' => $householdCode,
                'client_record_id' => $clientRecordId !== '' ? $clientRecordId : null,
                'record_year' => $recordYear,
                'rollover_source_household_code' => $rolloverSourceHouseholdCode,
                'source' => $source,
                'head_name' => $headName,
                'zone' => $zone,
                'member_count' => $memberCount,
                'head_data_json' => reg_json_encode($head),
                'members_data_json' => reg_json_encode($members),
                'record_data_json' => reg_json_encode($recordForStore),
                'created_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
                'updated_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
            ]);
            $householdDbId = (int) $pdo->lastInsertId();
        }

        $existingResidents = $pdo->prepare(
            'SELECT `resident_code`, `source_type`, `member_order`
             FROM `registration_residents`
             WHERE `household_id` = :household_id'
        );
        $existingResidents->execute(['household_id' => $householdDbId]);
        $existingRows = $existingResidents->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $existingHeadResidentCode = '';
        $existingMemberResidentCodes = [];
        foreach ($existingRows as $existingRow) {
            if (!is_array($existingRow)) {
                continue;
            }
            $residentCode = reg_text($existingRow['resident_code'] ?? '', 64);
            if ($residentCode === '') {
                continue;
            }
            $sourceType = reg_text($existingRow['source_type'] ?? '', 16);
            $memberOrder = (int) ($existingRow['member_order'] ?? 0);
            if ($sourceType === 'head') {
                $existingHeadResidentCode = $residentCode;
                continue;
            }
            if ($sourceType === 'member' && $memberOrder > 0) {
                $existingMemberResidentCodes[$memberOrder] = $residentCode;
            }
        }

        $pdo->prepare('DELETE FROM `registration_members` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);
        $pdo->prepare('DELETE FROM `registration_residents` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);

        $insertResident = $pdo->prepare(
            'INSERT INTO `registration_residents`
             (`resident_code`, `household_id`, `household_code`, `record_year`, `source_type`, `member_order`,
              `full_name`, `relation_to_head`, `sex`, `age`, `zone`, `resident_data_json`)
             VALUES
             (:resident_code, :household_id, :household_code, :record_year, :source_type, :member_order,
              :full_name, :relation_to_head, :sex, :age, :zone, :resident_data_json)'
        );

        $headResidentCode = $existingHeadResidentCode !== ''
            ? $existingHeadResidentCode
            : reg_next_resident_code($pdo, $householdCode);
        $insertResident->execute([
            'resident_code' => $headResidentCode,
            'household_id' => $householdDbId,
            'household_code' => $householdCode,
            'record_year' => $recordYear,
            'source_type' => 'head',
            'member_order' => 0,
            'full_name' => $headName,
            'relation_to_head' => 'Head',
            'sex' => reg_text($head['sex'] ?? '', 20),
            'age' => reg_text($head['age'] ?? '', 20),
            'zone' => reg_text($head['zone'] ?? '', 80),
            'resident_data_json' => reg_json_encode(['head' => $head]),
        ]);

        $insertMember = $pdo->prepare(
            'INSERT INTO `registration_members`
             (`household_id`, `household_code`, `record_year`, `resident_code`, `member_order`,
              `full_name`, `relation_to_head`, `sex`, `age`, `zone`, `member_data_json`)
             VALUES
             (:household_id, :household_code, :record_year, :resident_code, :member_order,
              :full_name, :relation_to_head, :sex, :age, :zone, :member_data_json)'
        );

        foreach ($members as $index => $member) {
            $memberOrder = $index + 1;
            $memberName = trim(
                reg_text($member['first_name'] ?? '', 80) . ' ' .
                reg_text($member['middle_name'] ?? '', 80) . ' ' .
                reg_text($member['last_name'] ?? '', 80) . ' ' .
                reg_text($member['extension_name'] ?? '', 40)
            );
            if ($memberName === '') {
                $memberName = "Member {$memberOrder}";
            }
            $residentCode = $existingMemberResidentCodes[$memberOrder] ?? reg_next_resident_code($pdo, $householdCode);

            $insertMember->execute([
                'household_id' => $householdDbId,
                'household_code' => $householdCode,
                'record_year' => $recordYear,
                'resident_code' => $residentCode,
                'member_order' => $memberOrder,
                'full_name' => $memberName,
                'relation_to_head' => reg_text($member['relation_to_head'] ?? '', 120),
                'sex' => reg_text($member['sex'] ?? '', 20),
                'age' => reg_text($member['age'] ?? '', 20),
                'zone' => reg_text($member['zone'] ?? '', 80),
                'member_data_json' => reg_json_encode($member),
            ]);

            $insertResident->execute([
                'resident_code' => $residentCode,
                'household_id' => $householdDbId,
                'household_code' => $householdCode,
                'record_year' => $recordYear,
                'source_type' => 'member',
                'member_order' => $memberOrder,
                'full_name' => $memberName,
                'relation_to_head' => reg_text($member['relation_to_head'] ?? '', 120),
                'sex' => reg_text($member['sex'] ?? '', 20),
                'age' => reg_text($member['age'] ?? '', 20),
                'zone' => reg_text($member['zone'] ?? '', 80),
                'resident_data_json' => reg_json_encode(['member' => $member]),
            ]);
        }

        if ($photoSchemaAware) {
            $obsoletePhotoStorageKeys = reg_photo_mark_unreferenced(
                $pdo,
                $householdCode,
                array_keys($photoReferences)
            );
        }

        $versionStmt = $pdo->prepare(
            'SELECT `row_version`, `updated_at` FROM `registration_households` WHERE `id` = :id LIMIT 1'
        );
        $versionStmt->execute(['id' => $householdDbId]);
        $versionRow = $versionStmt->fetch(PDO::FETCH_ASSOC);
        $serverRowVersion = is_array($versionRow) ? max(1, (int) ($versionRow['row_version'] ?? 1)) : 1;
        $serverUpdatedAt = is_array($versionRow) ? reg_text($versionRow['updated_at'] ?? '', 40) : '';
        if ($serverUpdatedAt !== '') {
            $recordForStore['updated_at'] = $serverUpdatedAt;
        }
        $recordForStore['row_version'] = $serverRowVersion;
        $recordForStore['base_version'] = $serverRowVersion;
        if ($startedTransaction && $pdo->inTransaction()) {
            $pdo->commit();
            reg_photo_delete_storage_keys($obsoletePhotoStorageKeys);
        }
        return [
            'household_id' => $householdCode,
            'record_year' => $recordYear,
            'synced_at' => $syncedAt,
            'updated_at' => $serverUpdatedAt,
            'row_version' => $serverRowVersion,
            'total_records' => reg_total_households($pdo),
            'record' => $recordForStore,
        ];
    } catch (Throwable $exception) {
        if ($startedTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    } finally {
        if ($codeLockAcquired) {
            reg_release_advisory_lock($pdo, $codeLockName);
        }
        reg_release_advisory_lock($pdo, $duplicateLockName);
    }
}

function reg_latest_household_year(PDO $pdo, int $beforeYear = 0): int
{
    $sql = 'SELECT MAX(`record_year`) FROM `registration_households` WHERE `record_year` BETWEEN 2000 AND 2100';
    $params = [];
    if (reg_valid_record_year($beforeYear)) {
        $sql .= ' AND `record_year` < :before_year';
        $params['before_year'] = $beforeYear;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $year = (int) $stmt->fetchColumn();
    return reg_valid_record_year($year) ? $year : 0;
}

/**
 * @return array<string, mixed>|null
 */
function reg_get_rollover_status(PDO $pdo, int $targetYear): ?array
{
    if (!reg_valid_record_year($targetYear)) {
        return null;
    }

    $stmt = $pdo->prepare(
        'SELECT `source_year`, `target_year`, `status`, `source_household_count`,
                `created_household_count`, `skipped_household_count`, `completed_at`
         FROM `registration_year_rollovers`
         WHERE `target_year` = :target_year
         LIMIT 1'
    );
    $stmt->execute(['target_year' => $targetYear]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }

    return [
        'source_year' => (int) ($row['source_year'] ?? 0),
        'target_year' => (int) ($row['target_year'] ?? 0),
        'status' => reg_text($row['status'] ?? 'completed', 20),
        'source_household_count' => (int) ($row['source_household_count'] ?? 0),
        'created_household_count' => (int) ($row['created_household_count'] ?? 0),
        'skipped_household_count' => (int) ($row['skipped_household_count'] ?? 0),
        'completed_at' => (string) ($row['completed_at'] ?? ''),
    ];
}

/**
 * @return array<int, array<string, mixed>>
 */
function reg_list_rollover_statuses(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT `source_year`, `target_year`, `status`, `source_household_count`,
                `created_household_count`, `skipped_household_count`, `completed_at`
         FROM `registration_year_rollovers`
         ORDER BY `target_year` DESC'
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $items = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $targetYear = (int) ($row['target_year'] ?? 0);
        if (!reg_valid_record_year($targetYear)) {
            continue;
        }
        $items[] = [
            'source_year' => (int) ($row['source_year'] ?? 0),
            'target_year' => $targetYear,
            'status' => reg_text($row['status'] ?? 'completed', 20),
            'source_household_count' => (int) ($row['source_household_count'] ?? 0),
            'created_household_count' => (int) ($row['created_household_count'] ?? 0),
            'skipped_household_count' => (int) ($row['skipped_household_count'] ?? 0),
            'completed_at' => (string) ($row['completed_at'] ?? ''),
        ];
    }

    return $items;
}

/**
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function reg_rollover_households(PDO $pdo, int $targetYear, int $sourceYear, array $authUser): array
{
    if (!reg_valid_record_year($targetYear)) {
        throw new InvalidArgumentException('A valid target year is required.');
    }

    $existingRollover = reg_get_rollover_status($pdo, $targetYear);
    if (is_array($existingRollover) && reg_text($existingRollover['status'] ?? '', 20) === 'completed') {
        throw new InvalidArgumentException("Rollover already completed for {$targetYear}.");
    }

    if (!reg_valid_record_year($sourceYear)) {
        $sourceYear = reg_latest_household_year($pdo, $targetYear);
    }
    if (!reg_valid_record_year($sourceYear)) {
        throw new InvalidArgumentException('No previous household data is available to roll over.');
    }
    if ($sourceYear === $targetYear) {
        throw new InvalidArgumentException('Source year and target year must be different.');
    }

    $sourceStmt = $pdo->prepare(
        'SELECT `household_code`, `head_name`, `zone`, `source`, `head_data_json`, `members_data_json`, `record_data_json`
         FROM `registration_households`
         WHERE `record_year` = :record_year
         ORDER BY `household_code` ASC'
    );
    $sourceStmt->execute(['record_year' => $sourceYear]);
    $sourceRows = $sourceStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (count($sourceRows) === 0) {
        throw new InvalidArgumentException("No household records found for {$sourceYear}.");
    }

    $existingTargetStmt = $pdo->prepare(
        'SELECT `household_code`
         FROM `registration_households`
         WHERE `record_year` = :record_year'
    );
    $existingTargetStmt->execute(['record_year' => $targetYear]);
    $existingTargetRows = $existingTargetStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $existingTargetCodes = [];
    foreach ($existingTargetRows as $targetRow) {
        if (!is_array($targetRow)) {
            continue;
        }
        $code = reg_text($targetRow['household_code'] ?? '', 64);
        if ($code !== '') {
            $existingTargetCodes[$code] = true;
        }
    }

    $created = 0;
    $skipped = 0;
    $createdIds = [];
    $skippedIds = [];
    $syncedAt = gmdate('c');
    $actorUserId = (int) ($authUser['id'] ?? 0);

    $pdo->beginTransaction();
    try {
        foreach ($sourceRows as $sourceRow) {
            if (!is_array($sourceRow)) {
                continue;
            }

            $sourceHouseholdCode = reg_text($sourceRow['household_code'] ?? '', 64);
            if ($sourceHouseholdCode === '') {
                continue;
            }

            $targetHouseholdCode = reg_household_code_for_year($sourceHouseholdCode, $targetYear);
            if ($targetHouseholdCode === '') {
                continue;
            }

            if (isset($existingTargetCodes[$targetHouseholdCode])) {
                $skipped += 1;
                if (count($skippedIds) < 10) {
                    $skippedIds[] = $targetHouseholdCode;
                }
                continue;
            }

            $head = reg_normalize_person_text_fields(
                reg_json_decode_assoc((string) ($sourceRow['head_data_json'] ?? ''))
            );
            unset($head['profile_photo_id']);
            $members = [];
            foreach (reg_normalize_members(reg_json_decode_assoc((string) ($sourceRow['members_data_json'] ?? ''))) as $memberRow) {
                $normalizedMember = reg_normalize_person_text_fields($memberRow);
                unset($normalizedMember['profile_photo_id']);
                $members[] = $normalizedMember;
            }

            if (count($members) === 0) {
                $loaded = reg_get_household($pdo, $sourceHouseholdCode);
                $loadedMembers = is_array($loaded['record']['members'] ?? null) ? $loaded['record']['members'] : [];
                foreach (reg_normalize_members($loadedMembers) as $memberRow) {
                    $normalizedMember = reg_normalize_person_text_fields($memberRow);
                    unset($normalizedMember['profile_photo_id']);
                    $members[] = $normalizedMember;
                }
            }
            if (count($members) === 0) {
                continue;
            }

            $sourceRecord = reg_json_decode_assoc((string) ($sourceRow['record_data_json'] ?? ''));
            $zone = reg_normalize_zone_text($sourceRow['zone'] ?? ($sourceRecord['zone'] ?? ($head['zone'] ?? '')));
            if ($zone === '') {
                $zone = reg_normalize_zone_text($head['zone'] ?? '');
            }
            if ($zone === '') {
                continue;
            }

            $rolloverRecord = [
                'household_id' => $targetHouseholdCode,
                'mode' => 'rollover',
                'source' => reg_text($sourceRow['source'] ?? 'registration-rollover', 80),
                'head' => $head,
                'members' => $members,
                'head_name' => reg_text($sourceRow['head_name'] ?? ($sourceRecord['head_name'] ?? ''), 180),
                'zone' => $zone,
                'member_count' => max(1, count($members) + 1),
                'record_year' => $targetYear,
                'rolled_over_from_household_id' => $sourceHouseholdCode,
                'rolled_over_from_year' => $sourceYear,
                'created_at' => $syncedAt,
                'updated_at' => $syncedAt,
            ];

            $existingDuplicate = reg_find_duplicate_household($pdo, $rolloverRecord, $targetHouseholdCode);
            if (is_array($existingDuplicate)) {
                $skipped += 1;
                if (count($skippedIds) < 10) {
                    $skippedIds[] = (string) ($existingDuplicate['household_id'] ?? $targetHouseholdCode);
                }
                continue;
            }

            reg_upsert_household($pdo, $rolloverRecord, $authUser);

            $existingTargetCodes[$targetHouseholdCode] = true;
            $created += 1;
            if (count($createdIds) < 10) {
                $createdIds[] = $targetHouseholdCode;
            }
        }

        $upsertStatusStmt = $pdo->prepare(
            'INSERT INTO `registration_year_rollovers`
             (`source_year`, `target_year`, `status`, `source_household_count`,
              `created_household_count`, `skipped_household_count`, `completed_by_user_id`, `completed_at`)
             VALUES
             (:source_year, :target_year, "completed", :source_household_count,
              :created_household_count, :skipped_household_count, :completed_by_user_id, CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE
               `source_year` = VALUES(`source_year`),
               `status` = "completed",
               `source_household_count` = VALUES(`source_household_count`),
               `created_household_count` = VALUES(`created_household_count`),
               `skipped_household_count` = VALUES(`skipped_household_count`),
               `completed_by_user_id` = VALUES(`completed_by_user_id`),
               `completed_at` = CURRENT_TIMESTAMP'
        );
        $upsertStatusStmt->execute([
            'source_year' => $sourceYear,
            'target_year' => $targetYear,
            'source_household_count' => count($sourceRows),
            'created_household_count' => $created,
            'skipped_household_count' => $skipped,
            'completed_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    return [
        'source_year' => $sourceYear,
        'target_year' => $targetYear,
        'status' => 'completed',
        'created' => $created,
        'skipped' => $skipped,
        'total_source_households' => count($sourceRows),
        'created_household_ids' => $createdIds,
        'skipped_household_ids' => $skippedIds,
        'completed_at' => $syncedAt,
        'total_records' => reg_total_households($pdo),
    ];
}

/**
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function reg_reset_rollover_households(PDO $pdo, int $targetYear, array $authUser): array
{
    if (!reg_valid_record_year($targetYear)) {
        throw new InvalidArgumentException('A valid target year is required.');
    }

    $householdStmt = $pdo->prepare(
        'SELECT `id`, `household_code`
         FROM `registration_households`
         WHERE `record_year` = :target_year
           AND `rollover_source_household_code` <> ""
         ORDER BY `household_code` ASC'
    );
    $householdStmt->execute(['target_year' => $targetYear]);
    $rows = $householdStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $householdIds = [];
    $householdCodes = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $householdId = (int) ($row['id'] ?? 0);
        $householdCode = reg_text($row['household_code'] ?? '', 64);
        if ($householdId <= 0 || $householdCode === '') {
            continue;
        }
        $householdIds[] = $householdId;
        $householdCodes[] = $householdCode;
    }

    $existingStatus = reg_get_rollover_status($pdo, $targetYear);
    if (count($householdIds) === 0 && !is_array($existingStatus)) {
        throw new InvalidArgumentException("No completed rollover data was found for {$targetYear}.");
    }

    $deleteMembersStmt = $pdo->prepare('DELETE FROM `registration_members` WHERE `household_id` = :household_id');
    $deleteResidentsStmt = $pdo->prepare('DELETE FROM `registration_residents` WHERE `household_id` = :household_id');
    $deleteHouseholdStmt = $pdo->prepare('DELETE FROM `registration_households` WHERE `id` = :id LIMIT 1');
    $deleteStatusStmt = $pdo->prepare('DELETE FROM `registration_year_rollovers` WHERE `target_year` = :target_year LIMIT 1');

    $deletedMembers = 0;
    $deletedResidents = 0;
    $deletedHouseholds = 0;
    $deletedStatus = false;
    $actorUserId = (int) ($authUser['id'] ?? 0);
    $photoStorageKeys = [];

    $pdo->beginTransaction();
    try {
        foreach ($householdIds as $index => $householdId) {
            $householdCode = $householdCodes[$index] ?? '';
            if ($householdCode !== '') {
                $photoStorageKeys = array_merge(
                    $photoStorageKeys,
                    reg_photo_mark_household_deleted($pdo, $householdCode)
                );
            }

            $deleteMembersStmt->execute(['household_id' => $householdId]);
            $deletedMembers += (int) $deleteMembersStmt->rowCount();

            $deleteResidentsStmt->execute(['household_id' => $householdId]);
            $deletedResidents += (int) $deleteResidentsStmt->rowCount();

            $deleteHouseholdStmt->execute(['id' => $householdId]);
            $deletedHouseholds += (int) $deleteHouseholdStmt->rowCount();
        }

        $deleteStatusStmt->execute(['target_year' => $targetYear]);
        $deletedStatus = (int) $deleteStatusStmt->rowCount() > 0;

        if ($deletedHouseholds === 0 && !$deletedStatus) {
            throw new InvalidArgumentException("No completed rollover data was found for {$targetYear}.");
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    // The database is now authoritative. Delete private files only after the
    // transaction commits so a rollback can never leave a live photo reference
    // pointing to a missing file.
    reg_photo_delete_storage_keys($photoStorageKeys);

    return [
        'target_year' => $targetYear,
        'status' => 'reset',
        'deleted_households' => $deletedHouseholds,
        'deleted_members' => $deletedMembers,
        'deleted_residents' => $deletedResidents,
        'deleted_rollover_status' => $deletedStatus,
        'deleted_household_ids' => array_slice($householdCodes, 0, 10),
        'performed_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
        'total_records' => reg_total_households($pdo),
    ];
}

auth_bootstrap_store();
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$requestAction = strtolower(reg_text($_GET['action'] ?? '', 40));
$captainReadableActions = ['', 'list_household_years', 'list_households', 'list_household_offline_records', 'get_household', 'list_residents', 'get_resident'];
$allowCaptainReadOnly = $requestMethod === 'GET' && in_array($requestAction, $captainReadableActions, true);
$allowedRoles = [AUTH_ROLE_STAFF, AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY];
if ($allowCaptainReadOnly) {
    $allowedRoles[] = AUTH_ROLE_CAPTAIN;
}

$authUser = auth_require_api($allowedRoles);
$pdo = auth_db();
$shouldRunSchemaMaintenance = reg_should_run_schema_maintenance($requestMethod !== 'GET');
if ($shouldRunSchemaMaintenance) {
    auth_ensure_users_columns($pdo);
    reg_bootstrap_tables($pdo);
    if ($requestMethod !== 'GET') {
        reg_ensure_sync_procedures($pdo);
    }
    reg_mark_schema_maintenance_complete();
}

function reg_list_households(PDO $pdo): array
{
    $limit = max(1, min(500, (int) ($_GET['limit'] ?? 100)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $recordYear = (int) ($_GET['year'] ?? 0);
    $zone = reg_text($_GET['zone'] ?? '', 80);
    $q = reg_text($_GET['q'] ?? '', 120);
    $includeRolloverStatuses = in_array(
        strtolower(reg_text($_GET['include_rollover_statuses'] ?? '', 8)),
        ['1', 'true', 'yes'],
        true
    );

    $sql = 'SELECT `household_code`, `record_year`, `rollover_source_household_code`, `head_name`, `zone`, `member_count`, `source`, `created_at`, `updated_at`
            FROM `registration_households`
            WHERE 1=1';
    $params = [];
    if (reg_valid_record_year($recordYear)) {
        $sql .= ' AND `record_year` = :record_year';
        $params['record_year'] = $recordYear;
    }
    if ($zone !== '') {
        $sql .= ' AND `zone` = :zone';
        $params['zone'] = $zone;
    }
    if ($q !== '') {
        $sql .= ' AND (`household_code` LIKE :q_household_code OR `head_name` LIKE :q_head_name OR `zone` LIKE :q_zone)';
        $params['q_household_code'] = '%' . $q . '%';
        $params['q_head_name'] = '%' . $q . '%';
        $params['q_zone'] = '%' . $q . '%';
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $payload = [
        'items' => array_map(static fn(array $row): array => [
            'household_id' => (string) ($row['household_code'] ?? ''),
            'record_year' => (int) ($row['record_year'] ?? 0),
            'rollover_source_household_id' => (string) ($row['rollover_source_household_code'] ?? ''),
            'head_name' => (string) ($row['head_name'] ?? ''),
            'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
            'member_count' => (int) ($row['member_count'] ?? 0),
            'source' => (string) ($row['source'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ], $rows),
        'count' => count($rows),
        'limit' => $limit,
        'offset' => $offset,
    ];

    if ($includeRolloverStatuses) {
        $payload['rollover_statuses'] = reg_list_rollover_statuses($pdo);
    }

    return $payload;
}

function reg_list_household_duplicate_index(PDO $pdo): array
{
    $limit = max(1, min(500, (int) ($_GET['limit'] ?? 250)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $recordYear = reg_parse_year_value($_GET['year'] ?? 0);

    if (!reg_valid_record_year($recordYear)) {
        return [
            'items' => [],
            'count' => 0,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => false,
        ];
    }

    $sql = 'SELECT `household_code`, `record_year`, `head_name`, `zone`, `head_data_json`, `record_data_json`, `created_at`, `updated_at`
            FROM `registration_households`
            WHERE `record_year` = :record_year
            ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['record_year' => $recordYear]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $items = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $rowRecord = reg_duplicate_record_from_household_row($row);
        $duplicateKeys = reg_household_duplicate_keys($rowRecord);
        if (count($duplicateKeys) === 0) {
            continue;
        }

        $items[] = [
            'household_id' => (string) ($row['household_code'] ?? ''),
            'record_year' => (int) ($row['record_year'] ?? 0),
            'head_name' => (string) ($row['head_name'] ?? ''),
            'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'duplicate_keys' => $duplicateKeys,
        ];
    }

    return [
        'items' => $items,
        'count' => count($rows),
        'limit' => $limit,
        'offset' => $offset,
        'has_more' => count($rows) === $limit,
    ];
}

function reg_list_household_years(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT DISTINCT `record_year`
         FROM `registration_households`
         WHERE `record_year` BETWEEN 2000 AND 2100
         ORDER BY `record_year` DESC'
    );

    $years = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $value) {
        $year = (int) $value;
        if (reg_valid_record_year($year)) {
            $years[] = $year;
        }
    }

    return array_values(array_unique($years));
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function reg_build_household_payload(PDO $pdo, array $row): array
{
    $householdCode = (string) ($row['household_code'] ?? '');
    $householdId = (int) ($row['id'] ?? 0);
    $rowVersion = max(1, (int) ($row['row_version'] ?? 1));

    $record = reg_json_decode_assoc((string) ($row['record_data_json'] ?? ''));
    $record['household_id'] = (string) ($row['household_code'] ?? $householdCode);
    $record['client_record_id'] = (string) ($row['client_record_id'] ?? ($record['client_record_id'] ?? ''));
    $record['record_year'] = (int) ($row['record_year'] ?? ($record['record_year'] ?? 0));
    $record['rollover_source_household_id'] = (string) ($row['rollover_source_household_code'] ?? ($record['rollover_source_household_id'] ?? ''));
    $record['head_name'] = (string) ($row['head_name'] ?? ($record['head_name'] ?? ''));
    $record['zone'] = reg_normalize_zone_text($row['zone'] ?? ($record['zone'] ?? ''));
    $record['member_count'] = (int) ($row['member_count'] ?? ($record['member_count'] ?? 0));
    $record['source'] = (string) ($row['source'] ?? ($record['source'] ?? 'registration-module'));
    $record['row_version'] = $rowVersion;
    $record['base_version'] = $rowVersion;
    $record['head'] = reg_strip_health_fields(reg_json_decode_assoc((string) ($row['head_data_json'] ?? '')));
    $record['members'] = array_map(
        static fn (array $member): array => reg_strip_health_fields($member),
        reg_normalize_members(reg_json_decode_assoc((string) ($row['members_data_json'] ?? '')))
    );
    if ((!is_array($record['members']) || count($record['members']) === 0) && $householdId > 0) {
        $membersStmt = $pdo->prepare(
            'SELECT `member_data_json`
             FROM `registration_members`
             WHERE `household_id` = :household_id
             ORDER BY `member_order` ASC'
        );
        $membersStmt->execute(['household_id' => $householdId]);
        $memberRows = $membersStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $members = [];
        foreach ($memberRows as $memberRow) {
            if (!is_array($memberRow)) {
                continue;
            }
            $member = reg_strip_health_fields(reg_json_decode_assoc((string) ($memberRow['member_data_json'] ?? '')));
            if ($member) {
                $members[] = $member;
            }
        }
        $record['members'] = $members;
    }

    $recordHead = is_array($record['head'] ?? null) ? $record['head'] : [];
    $recordHead['zone'] = reg_normalize_zone_text($recordHead['zone'] ?? $record['zone']);
    $record['head'] = $recordHead;
    $record['zone'] = reg_normalize_zone_text($record['zone'] ?? $recordHead['zone']);
    $recordMembers = is_array($record['members'] ?? null) ? $record['members'] : [];
    foreach ($recordMembers as $memberIndex => $memberRow) {
        if (!is_array($memberRow)) {
            continue;
        }
        $recordMembers[$memberIndex]['zone'] = reg_normalize_zone_text($memberRow['zone'] ?? $record['zone']);
    }
    $record['members'] = $recordMembers;

    return [
        'household_id' => (string) ($row['household_code'] ?? ''),
        'client_record_id' => (string) ($row['client_record_id'] ?? ''),
        'record_year' => (int) ($row['record_year'] ?? 0),
        'rollover_source_household_id' => (string) ($row['rollover_source_household_code'] ?? ''),
        'head_name' => (string) ($row['head_name'] ?? ''),
        'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
        'member_count' => (int) ($row['member_count'] ?? 0),
        'source' => (string) ($row['source'] ?? ''),
        'row_version' => $rowVersion,
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'record' => $record,
    ];
}

function reg_list_household_offline_records(PDO $pdo): array
{
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 100)));
    $afterId = max(0, (int) ($_GET['after_id'] ?? 0));
    $recordYear = reg_parse_year_value($_GET['year'] ?? 0);
    if (!reg_valid_record_year($recordYear)) {
        reg_error(422, 'A valid household record year is required.');
    }
    $fetchLimit = $limit + 1;

    $sql = 'SELECT `id`, `household_code`, `client_record_id`, `record_year`, `rollover_source_household_code`, `head_name`, `zone`, `member_count`, `source`,
                   `row_version`, `head_data_json`, `members_data_json`, `record_data_json`, `created_at`, `updated_at`
            FROM `registration_households`
            WHERE `record_year` = :record_year
              AND `id` > :after_id
            ORDER BY `id` ASC
            LIMIT ' . $fetchLimit;
    $params = [
        'record_year' => $recordYear,
        'after_id' => $afterId,
    ];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $hasMore = count($rows) > $limit;
    if ($hasMore) {
        $rows = array_slice($rows, 0, $limit);
    }
    $nextAfterId = $afterId;

    $items = [];
    foreach ($rows as $row) {
        if (is_array($row)) {
            $items[] = reg_build_household_payload($pdo, $row);
            $nextAfterId = max($nextAfterId, (int) ($row['id'] ?? 0));
        }
    }

    return [
        'items' => $items,
        'count' => count($items),
        'limit' => $limit,
        'after_id' => $afterId,
        'next_after_id' => $nextAfterId,
        'has_more' => $hasMore,
    ];
}

function reg_get_household(PDO $pdo, string $householdCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `household_code`, `client_record_id`, `record_year`, `rollover_source_household_code`, `head_name`, `zone`, `member_count`, `source`,
                `row_version`, `head_data_json`, `members_data_json`, `record_data_json`, `created_at`, `updated_at`
         FROM `registration_households`
         WHERE `household_code` = :household_code
         LIMIT 1'
    );
    $stmt->execute(['household_code' => $householdCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }

    return reg_build_household_payload($pdo, $row);
}

function reg_list_members(PDO $pdo): array
{
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 300)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $householdCode = reg_text($_GET['household_id'] ?? '', 64);
    $q = reg_text($_GET['q'] ?? '', 120);

    $sql = 'SELECT `resident_code`, `household_code`, `record_year`, `member_order`, `full_name`, `relation_to_head`,
                   `sex`, `age`, `zone`, `updated_at`, `member_data_json`
            FROM `registration_members`
            WHERE 1=1';
    $params = [];
    if ($householdCode !== '') {
        $sql .= ' AND `household_code` = :household_code';
        $params['household_code'] = $householdCode;
    }
    if ($q !== '') {
        $sql .= ' AND (`resident_code` LIKE :q_resident_code OR `full_name` LIKE :q_full_name)';
        $params['q_resident_code'] = '%' . $q . '%';
        $params['q_full_name'] = '%' . $q . '%';
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return [
        'items' => array_map(static fn(array $row): array => [
            'resident_id' => (string) ($row['resident_code'] ?? ''),
            'household_id' => (string) ($row['household_code'] ?? ''),
            'record_year' => (int) ($row['record_year'] ?? 0),
            'member_order' => (int) ($row['member_order'] ?? 0),
            'full_name' => (string) ($row['full_name'] ?? ''),
            'relation_to_head' => (string) ($row['relation_to_head'] ?? ''),
            'sex' => (string) ($row['sex'] ?? ''),
            'age' => (string) ($row['age'] ?? ''),
            'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
            'member' => reg_strip_health_fields(reg_json_decode_assoc((string) ($row['member_data_json'] ?? ''))),
        ], $rows),
        'count' => count($rows),
        'limit' => $limit,
        'offset' => $offset,
    ];
}

function reg_get_member(PDO $pdo, string $residentCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `resident_code`, `household_code`, `record_year`, `member_order`, `full_name`, `relation_to_head`,
                `sex`, `age`, `zone`, `created_at`, `updated_at`, `member_data_json`
         FROM `registration_members`
         WHERE `resident_code` = :resident_code
         LIMIT 1'
    );
    $stmt->execute(['resident_code' => $residentCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    return [
        'resident_id' => (string) ($row['resident_code'] ?? ''),
        'household_id' => (string) ($row['household_code'] ?? ''),
        'record_year' => (int) ($row['record_year'] ?? 0),
        'member_order' => (int) ($row['member_order'] ?? 0),
        'full_name' => (string) ($row['full_name'] ?? ''),
        'relation_to_head' => (string) ($row['relation_to_head'] ?? ''),
        'sex' => (string) ($row['sex'] ?? ''),
        'age' => (string) ($row['age'] ?? ''),
        'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'member' => reg_strip_health_fields(reg_json_decode_assoc((string) ($row['member_data_json'] ?? ''))),
    ];
}

/**
 * Remove legacy/raw photo fields and expose only a validated UUID-v4 photo id.
 * Corrupt legacy values are treated as "no photo" so one bad row cannot break
 * the residents directory.
 *
 * @param array<string, mixed> $profile
 * @return array<string, mixed>
 */
function reg_resident_profile_for_output(array $profile): array
{
    foreach ([
        'photo',
        'photo_url',
        'photo_data',
        'profile_photo',
        'profile_photo_url',
        'profile_photo_data',
    ] as $unsafeField) {
        unset($profile[$unsafeField]);
    }

    try {
        $profilePhotoId = reg_photo_normalize_id($profile['profile_photo_id'] ?? '');
    } catch (InvalidArgumentException $exception) {
        $profilePhotoId = '';
    }
    unset($profile['profile_photo_id']);
    if ($profilePhotoId !== '') {
        $profile['profile_photo_id'] = $profilePhotoId;
    }

    return $profile;
}

function reg_list_residents(PDO $pdo): array
{
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 300)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $householdCode = reg_text($_GET['household_id'] ?? '', 64);
    $zone = reg_text($_GET['zone'] ?? '', 80);
    $q = reg_text($_GET['q'] ?? '', 120);

    $sql = 'SELECT `resident_code`, `household_code`, `record_year`, `source_type`, `member_order`, `full_name`,
                   `relation_to_head`, `sex`, `age`, `zone`, `updated_at`, `resident_data_json`
            FROM `registration_residents`
            WHERE 1=1';
    $params = [];
    if ($householdCode !== '') {
        $sql .= ' AND `household_code` = :household_code';
        $params['household_code'] = $householdCode;
    }
    if ($zone !== '') {
        $sql .= ' AND `zone` = :zone';
        $params['zone'] = $zone;
    }
    if ($q !== '') {
        $sql .= ' AND (`resident_code` LIKE :q_resident_code OR `full_name` LIKE :q_full_name)';
        $params['q_resident_code'] = '%' . $q . '%';
        $params['q_full_name'] = '%' . $q . '%';
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return [
        'items' => array_map(static function (array $row): array {
            $resident = reg_json_decode_assoc((string) ($row['resident_data_json'] ?? ''));
            $profile = is_array($resident['member'] ?? null)
                ? $resident['member']
                : (is_array($resident['head'] ?? null) ? $resident['head'] : $resident);
            $profileRaw = reg_resident_profile_for_output(is_array($profile) ? $profile : []);
            $pwd = (string) ($profileRaw['pwd'] ?? ($profileRaw['health_has_disability'] ?? ''));
            $pregnant = (string) ($profileRaw['pregnant'] ?? ($profileRaw['health_maternal_pregnant'] ?? ''));
            $profilePhotoId = (string) ($profileRaw['profile_photo_id'] ?? '');

            $item = [
                'resident_id' => (string) ($row['resident_code'] ?? ''),
                'household_id' => (string) ($row['household_code'] ?? ''),
                'record_year' => (int) ($row['record_year'] ?? 0),
                'source_type' => (string) ($row['source_type'] ?? ''),
                'member_order' => (int) ($row['member_order'] ?? 0),
                'full_name' => (string) ($row['full_name'] ?? ''),
                'relation_to_head' => (string) ($row['relation_to_head'] ?? ''),
                'sex' => (string) ($row['sex'] ?? ''),
                'age' => (string) ($row['age'] ?? ''),
                'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
                'updated_at' => (string) ($row['updated_at'] ?? ''),
                'pwd' => $pwd,
                'pregnant' => $pregnant,
            ];
            if ($profilePhotoId !== '') {
                $item['profile_photo_id'] = $profilePhotoId;
            }
            return $item;
        }, $rows),
        'count' => count($rows),
        'limit' => $limit,
        'offset' => $offset,
    ];
}

function reg_get_resident(PDO $pdo, string $residentCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `resident_code`, `household_code`, `record_year`, `source_type`, `member_order`, `full_name`,
                `relation_to_head`, `sex`, `age`, `zone`, `created_at`, `updated_at`, `resident_data_json`
         FROM `registration_residents`
         WHERE `resident_code` = :resident_code
         LIMIT 1'
    );
    $stmt->execute(['resident_code' => $residentCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }
    $resident = reg_json_decode_assoc((string) ($row['resident_data_json'] ?? ''));
    $profilePhotoId = '';
    if (is_array($resident)) {
        $profile = is_array($resident['member'] ?? null)
            ? $resident['member']
            : (is_array($resident['head'] ?? null) ? $resident['head'] : $resident);
        if (is_array($profile)) {
            $profile = reg_strip_health_fields(reg_resident_profile_for_output($profile));
            $profilePhotoId = (string) ($profile['profile_photo_id'] ?? '');
            $profile['zone'] = reg_normalize_zone_text($profile['zone'] ?? ($row['zone'] ?? ''));
            if (is_array($resident['member'] ?? null)) {
                $resident['member'] = $profile;
            } elseif (is_array($resident['head'] ?? null)) {
                $resident['head'] = $profile;
            } else {
                $resident = $profile;
            }
        }
    }

    $result = [
        'resident_id' => (string) ($row['resident_code'] ?? ''),
        'household_id' => (string) ($row['household_code'] ?? ''),
        'record_year' => (int) ($row['record_year'] ?? 0),
        'source_type' => (string) ($row['source_type'] ?? ''),
        'member_order' => (int) ($row['member_order'] ?? 0),
        'full_name' => (string) ($row['full_name'] ?? ''),
        'relation_to_head' => (string) ($row['relation_to_head'] ?? ''),
        'sex' => (string) ($row['sex'] ?? ''),
        'age' => (string) ($row['age'] ?? ''),
        'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'resident' => $resident,
    ];
    if ($profilePhotoId !== '') {
        $result['profile_photo_id'] = $profilePhotoId;
    }
    return $result;
}

function reg_delete_household(PDO $pdo, string $householdCode): bool
{
    $stmt = $pdo->prepare('SELECT `id` FROM `registration_households` WHERE `household_code` = :household_code LIMIT 1');
    $stmt->execute(['household_code' => $householdCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return false;
    }
    $householdDbId = (int) ($row['id'] ?? 0);
    if ($householdDbId <= 0) {
        return false;
    }

    $storageKeys = [];
    $pdo->beginTransaction();
    try {
        $storageKeys = reg_photo_mark_household_deleted($pdo, $householdCode);
        $pdo->prepare('DELETE FROM `registration_members` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);
        $pdo->prepare('DELETE FROM `registration_residents` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);
        $pdo->prepare('DELETE FROM `registration_households` WHERE `id` = :id LIMIT 1')
            ->execute(['id' => $householdDbId]);
        $pdo->commit();
        foreach ($storageKeys as $storageKey) {
            reg_photo_delete_storage_key($storageKey);
        }
        return true;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function reg_delete_member(PDO $pdo, string $residentCode): bool
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `household_id`, `household_code`, `member_order`, `member_data_json`
         FROM `registration_members`
         WHERE `resident_code` = :resident_code
         LIMIT 1'
    );
    $stmt->execute(['resident_code' => $residentCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return false;
    }

    $memberId = (int) ($row['id'] ?? 0);
    $householdDbId = (int) ($row['household_id'] ?? 0);
    $householdCode = reg_text($row['household_code'] ?? '', 64);
    $memberOrder = max(0, (int) ($row['member_order'] ?? 0));
    if ($memberId <= 0 || $householdDbId <= 0) {
        return false;
    }

    $obsoletePhotoStorageKeys = [];
    $pdo->beginTransaction();
    try {
        $householdStmt = $pdo->prepare(
            'SELECT `head_data_json`, `members_data_json`, `record_data_json`
             FROM `registration_households`
             WHERE `id` = :id
             LIMIT 1 FOR UPDATE'
        );
        $householdStmt->execute(['id' => $householdDbId]);
        $householdRow = $householdStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($householdRow)) {
            throw new RuntimeException('Household record was not found for this member.');
        }

        $targetMember = reg_json_decode_assoc((string) ($row['member_data_json'] ?? ''));
        $targetClientId = reg_optional_client_member_id($targetMember['client_member_id'] ?? '');
        $targetIdentity = reg_photo_person_match_key($targetMember);
        $storedMembers = reg_normalize_members(
            reg_json_decode_assoc((string) ($householdRow['members_data_json'] ?? ''))
        );
        $removedIndex = -1;
        if ($memberOrder > 0 && isset($storedMembers[$memberOrder - 1]) && is_array($storedMembers[$memberOrder - 1])) {
            $orderedMember = $storedMembers[$memberOrder - 1];
            $orderedClientId = reg_optional_client_member_id($orderedMember['client_member_id'] ?? '');
            $orderedIdentity = reg_photo_person_match_key($orderedMember);
            if (
                ($targetClientId !== '' && $orderedClientId === $targetClientId)
                || ($targetClientId === '' && $targetIdentity !== '' && $orderedIdentity === $targetIdentity)
            ) {
                $removedIndex = $memberOrder - 1;
            }
        }
        if ($removedIndex < 0) {
            foreach ($storedMembers as $index => $storedMember) {
                if (!is_array($storedMember)) continue;
                $storedClientId = reg_optional_client_member_id($storedMember['client_member_id'] ?? '');
                $storedIdentity = reg_photo_person_match_key($storedMember);
                if (
                    ($targetClientId !== '' && $storedClientId === $targetClientId)
                    || ($targetClientId === '' && $targetIdentity !== '' && $storedIdentity === $targetIdentity)
                ) {
                    $removedIndex = (int) $index;
                    break;
                }
            }
        }
        if ($removedIndex < 0 && $memberOrder > 0 && isset($storedMembers[$memberOrder - 1])) {
            $removedIndex = $memberOrder - 1;
        }
        if ($removedIndex >= 0) {
            array_splice($storedMembers, $removedIndex, 1);
        }

        $recordData = reg_json_decode_assoc((string) ($householdRow['record_data_json'] ?? ''));
        $recordData['members'] = array_values($storedMembers);
        $recordData['member_count'] = count($storedMembers) + 1;
        $recordData['updated_at'] = gmdate('c');

        $pdo->prepare('DELETE FROM `registration_members` WHERE `id` = :id LIMIT 1')
            ->execute(['id' => $memberId]);
        $pdo->prepare('DELETE FROM `registration_residents` WHERE `resident_code` = :resident_code AND `source_type` = "member" LIMIT 1')
            ->execute(['resident_code' => $residentCode]);

        $remainingMembersStmt = $pdo->prepare(
            'SELECT `id`, `resident_code`
             FROM `registration_members`
             WHERE `household_id` = :household_id
             ORDER BY `member_order` ASC, `id` ASC'
        );
        $remainingMembersStmt->execute(['household_id' => $householdDbId]);
        $remainingMemberRows = $remainingMembersStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $updateMemberOrder = $pdo->prepare(
            'UPDATE `registration_members` SET `member_order` = :member_order WHERE `id` = :id LIMIT 1'
        );
        $updateResidentOrder = $pdo->prepare(
            'UPDATE `registration_residents`
             SET `member_order` = :member_order
             WHERE `resident_code` = :resident_code AND `source_type` = "member"
             LIMIT 1'
        );
        foreach ($remainingMemberRows as $remainingIndex => $remainingRow) {
            if (!is_array($remainingRow)) continue;
            $nextOrder = $remainingIndex + 1;
            $updateMemberOrder->execute([
                'member_order' => $nextOrder,
                'id' => (int) ($remainingRow['id'] ?? 0),
            ]);
            $updateResidentOrder->execute([
                'member_order' => $nextOrder,
                'resident_code' => (string) ($remainingRow['resident_code'] ?? ''),
            ]);
        }

        $updateHousehold = $pdo->prepare(
            'UPDATE `registration_households`
             SET `member_count` = :member_count,
                 `members_data_json` = :members_data_json,
                 `record_data_json` = :record_data_json,
                 `row_version` = `row_version` + 1,
                 `updated_at` = CURRENT_TIMESTAMP
             WHERE `id` = :id
             LIMIT 1'
        );
        $updateHousehold->execute([
            'member_count' => count($storedMembers) + 1,
            'members_data_json' => reg_json_encode(array_values($storedMembers)),
            'record_data_json' => reg_json_encode($recordData),
            'id' => $householdDbId,
        ]);

        if ((int) ($recordData['photo_schema_version'] ?? 0) >= 1 && $householdCode !== '') {
            $retainedPhotoIds = [];
            $householdPhotoId = reg_photo_normalize_id($recordData['household_photo_id'] ?? '');
            if ($householdPhotoId !== '') $retainedPhotoIds[] = $householdPhotoId;
            $headData = is_array($recordData['head'] ?? null) ? $recordData['head'] : [];
            $headPhotoId = reg_photo_normalize_id($headData['profile_photo_id'] ?? '');
            if ($headPhotoId === '') {
                $storedHeadData = reg_json_decode_assoc((string) ($householdRow['head_data_json'] ?? ''));
                $headPhotoId = reg_photo_normalize_id($storedHeadData['profile_photo_id'] ?? '');
            }
            if ($headPhotoId !== '') $retainedPhotoIds[] = $headPhotoId;
            foreach ($storedMembers as $storedMember) {
                if (!is_array($storedMember)) continue;
                $memberPhotoId = reg_photo_normalize_id($storedMember['profile_photo_id'] ?? '');
                if ($memberPhotoId !== '') $retainedPhotoIds[] = $memberPhotoId;
            }
            $obsoletePhotoStorageKeys = reg_photo_mark_unreferenced(
                $pdo,
                $householdCode,
                $retainedPhotoIds
            );
        }

        $pdo->commit();
        reg_photo_delete_storage_keys($obsoletePhotoStorageKeys);
        return true;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

try {
    if ($requestMethod === 'GET') {
        $action = $requestAction;
        if ($action === '') {
            $summary = $pdo->query(
                'SELECT COUNT(*) AS total_records, MAX(`updated_at`) AS updated_at
                 FROM `registration_households`'
            )->fetch(PDO::FETCH_ASSOC) ?: [];
            reg_respond(200, [
                'success' => true,
                'count' => (int) ($summary['total_records'] ?? 0),
                'updated_at' => (string) ($summary['updated_at'] ?? ''),
            ]);
        }

        if ($action === 'list_households') {
            reg_respond(200, ['success' => true, 'data' => reg_list_households($pdo)]);
        }
        if ($action === 'list_household_offline_records') {
            reg_respond(200, ['success' => true, 'data' => reg_list_household_offline_records($pdo)]);
        }
        if ($action === 'list_household_duplicate_index') {
            reg_respond(200, ['success' => true, 'data' => reg_list_household_duplicate_index($pdo)]);
        }
        if ($action === 'list_household_years') {
            reg_respond(200, ['success' => true, 'data' => ['years' => reg_list_household_years($pdo)]]);
        }
        if ($action === 'get_household') {
            $householdCode = reg_text($_GET['household_id'] ?? '', 64);
            if ($householdCode === '') {
                reg_error(422, 'household_id is required.');
            }
            $payload = reg_get_household($pdo, $householdCode);
            if (!is_array($payload)) {
                reg_error(404, 'Household record not found.');
            }
            reg_respond(200, ['success' => true, 'data' => $payload]);
        }
        if ($action === 'list_members') {
            reg_respond(200, ['success' => true, 'data' => reg_list_members($pdo)]);
        }
        if ($action === 'get_member') {
            $residentCode = reg_text($_GET['resident_id'] ?? '', 64);
            if ($residentCode === '') {
                reg_error(422, 'resident_id is required.');
            }
            $payload = reg_get_member($pdo, $residentCode);
            if (!is_array($payload)) {
                reg_error(404, 'Member record not found.');
            }
            reg_respond(200, ['success' => true, 'data' => $payload]);
        }

        if ($action === 'list_residents') {
            reg_respond(200, ['success' => true, 'data' => reg_list_residents($pdo)]);
        }
        if ($action === 'get_resident') {
            $residentCode = reg_text($_GET['resident_id'] ?? '', 64);
            if ($residentCode === '') {
                reg_error(422, 'resident_id is required.');
            }
            $payload = reg_get_resident($pdo, $residentCode);
            if (!is_array($payload)) {
                reg_error(404, 'Resident record not found.');
            }
            reg_respond(200, ['success' => true, 'data' => $payload]);
        }

        reg_error(400, 'Unsupported action.');
    }

    if ($requestMethod !== 'POST') {
        reg_error(405, 'Method not allowed.');
    }

    $csrfToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!auth_csrf_valid($csrfToken)) {
        reg_error(419, 'Invalid CSRF token.');
    }

    $payload = reg_read_json_body();
    $action = strtolower(reg_text($payload['action'] ?? '', 40));
    if ($action === '') {
        reg_error(400, 'Action is required.');
    }

    if ($action === 'upsert') {
        $record = $payload['record'] ?? null;
        if (!is_array($record)) {
            reg_error(422, 'Record payload is required.');
        }
        $householdCode = reg_text($record['household_id'] ?? '', 64);
        if ($householdCode === '') {
            reg_error(422, 'household_id is required.');
        }
        $requestMode = strtolower(reg_text($record['mode'] ?? 'update', 20));
        if (!in_array($requestMode, ['create', 'update'], true)) {
            $requestMode = 'update';
        }
        $record['mode'] = $requestMode;
        if ($requestMode === 'create') {
            $duplicate = reg_find_duplicate_household($pdo, $record);
            if (is_array($duplicate)) {
                reg_respond(409, reg_duplicate_household_payload($duplicate));
            }
        }
        $wasExisting = $requestMode === 'update' && reg_household_exists($pdo, $householdCode);
        $memberRows = reg_normalize_members($record['members'] ?? []);
        try {
            $result = reg_upsert_household($pdo, $record, $authUser);
        } catch (InvalidArgumentException $exception) {
            reg_error(422, reg_text($exception->getMessage(), 220));
        }
        $syncedHouseholdCode = reg_text($result['household_id'] ?? $householdCode, 64);
        $wasIdempotent = ($result['idempotent'] ?? false) === true;
        reg_audit_log(
            $authUser,
            $wasIdempotent
                ? 'registration_household_sync_replayed'
                : ($wasExisting ? 'registration_household_updated' : 'registration_household_created'),
            $wasIdempotent ? 'synced' : ($wasExisting ? 'updated' : 'created'),
            $wasIdempotent
                ? 'Confirmed an already completed household sync.'
                : ($wasExisting ? 'Updated household record.' : 'Created household record.'),
            'household',
            $syncedHouseholdCode,
            [
                'member_rows' => count($memberRows),
                'source' => reg_text($record['source'] ?? '', 80),
            ]
        );
        reg_respond(200, ['success' => true] + $result);
    }

    if ($action === 'rollover_households') {
        $targetYear = reg_parse_year_value($payload['target_year'] ?? 0);
        if (!reg_valid_record_year($targetYear)) {
            reg_error(422, 'A valid target_year is required.');
        }
        $sourceYear = reg_parse_year_value($payload['source_year'] ?? 0);
        try {
            $result = reg_rollover_households($pdo, $targetYear, $sourceYear, $authUser);
        } catch (InvalidArgumentException $exception) {
            reg_error(422, reg_text($exception->getMessage(), 220));
        }
        reg_audit_log(
            $authUser,
            'registration_household_rollover',
            'created',
            'Rolled over household records to a new year.',
            'household_year',
            (string) $targetYear,
            [
                'source_year' => (int) ($result['source_year'] ?? 0),
                'target_year' => (int) ($result['target_year'] ?? 0),
                'created' => (int) ($result['created'] ?? 0),
                'skipped' => (int) ($result['skipped'] ?? 0),
            ]
        );
        reg_respond(200, ['success' => true] + $result);
    }

    if ($action === 'reset_rollover_households') {
        $requesterRole = auth_user_role($authUser);
        if (!in_array($requesterRole, [AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY], true)) {
            reg_error(403, 'Only admin users can reset rollover data.');
        }

        $targetYear = reg_parse_year_value($payload['target_year'] ?? 0);
        if (!reg_valid_record_year($targetYear)) {
            reg_error(422, 'A valid target_year is required.');
        }
        try {
            $result = reg_reset_rollover_households($pdo, $targetYear, $authUser);
        } catch (InvalidArgumentException $exception) {
            reg_error(422, reg_text($exception->getMessage(), 220));
        }
        reg_audit_log(
            $authUser,
            'registration_household_rollover_reset',
            'deleted',
            'Reset rolled-over household records.',
            'household_year',
            (string) $targetYear,
            [
                'target_year' => (int) ($result['target_year'] ?? 0),
                'deleted_households' => (int) ($result['deleted_households'] ?? 0),
                'deleted_members' => (int) ($result['deleted_members'] ?? 0),
                'deleted_residents' => (int) ($result['deleted_residents'] ?? 0),
            ]
        );
        reg_respond(200, ['success' => true] + $result);
    }

    if ($action === 'delete_household') {
        $householdCode = reg_text($payload['household_id'] ?? '', 64);
        if ($householdCode === '') {
            reg_error(422, 'household_id is required.');
        }
        if (!reg_delete_household($pdo, $householdCode)) {
            reg_error(404, 'Household record not found.');
        }
        reg_audit_log(
            $authUser,
            'registration_household_deleted',
            'deleted',
            'Deleted household record.',
            'household',
            $householdCode
        );
        reg_respond(200, [
            'success' => true,
            'household_id' => $householdCode,
            'total_records' => reg_total_households($pdo),
        ]);
    }

    if ($action === 'delete_member') {
        $residentCode = reg_text($payload['resident_id'] ?? '', 64);
        if ($residentCode === '') {
            reg_error(422, 'resident_id is required.');
        }
        if (!reg_delete_member($pdo, $residentCode)) {
            reg_error(404, 'Member record not found.');
        }
        reg_audit_log(
            $authUser,
            'registration_member_deleted',
            'deleted',
            'Deleted household member record.',
            'resident',
            $residentCode
        );
        reg_respond(200, ['success' => true, 'resident_id' => $residentCode]);
    }

    reg_error(400, 'Unsupported action.');
} catch (RegDuplicateHouseholdException $exception) {
    reg_respond(409, reg_duplicate_household_payload($exception->getDuplicate()));
} catch (RegHouseholdConflictException $exception) {
    reg_respond(409, [
        'success' => false,
        'code' => 'household_edit_conflict',
        'error' => $exception->getMessage(),
        'current' => $exception->getCurrent(),
    ]);
} catch (Throwable $exception) {
    reg_error(500, reg_friendly_server_error($exception));
}
