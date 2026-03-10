<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

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
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
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

function reg_bootstrap_tables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_households` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `household_code` VARCHAR(64) NOT NULL,
            `source` VARCHAR(80) NOT NULL DEFAULT "registration-module",
            `head_name` VARCHAR(180) NOT NULL DEFAULT "",
            `zone` VARCHAR(80) NOT NULL DEFAULT "",
            `member_count` INT UNSIGNED NOT NULL DEFAULT 0,
            `head_data_json` LONGTEXT NOT NULL,
            `members_data_json` LONGTEXT NOT NULL,
            `record_data_json` LONGTEXT NOT NULL,
            `created_by_user_id` BIGINT UNSIGNED NULL,
            `updated_by_user_id` BIGINT UNSIGNED NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_registration_households_code` (`household_code`),
            KEY `idx_registration_households_zone` (`zone`),
            KEY `idx_registration_households_updated_at` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_members` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `household_id` BIGINT UNSIGNED NOT NULL,
            `household_code` VARCHAR(64) NOT NULL,
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
            KEY `idx_registration_members_household_id` (`household_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_residents` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `resident_code` VARCHAR(64) NOT NULL,
            `household_id` BIGINT UNSIGNED NOT NULL,
            `household_code` VARCHAR(64) NOT NULL,
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
            KEY `idx_registration_residents_zone` (`zone`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
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
function reg_household_identity(array $head): string
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
 * @param array<string, mixed> $record
 * @return array<string, mixed>|null
 */
function reg_find_duplicate_household(PDO $pdo, array $record, string $excludeHouseholdCode = ''): ?array
{
    $head = is_array($record['head'] ?? null) ? $record['head'] : [];
    $identity = reg_household_identity($head);
    if ($identity === '') {
        return null;
    }

    $targetHouseholdCode = reg_text($record['household_id'] ?? '', 64);
    $targetYear = reg_household_year_from_code($targetHouseholdCode);
    if ($targetYear === '') {
        return null;
    }

    $sql = 'SELECT `household_code`, `head_name`, `zone`, `head_data_json`, `created_at`, `updated_at`
            FROM `registration_households`';
    $params = [];
    $where = [];
    if ($excludeHouseholdCode !== '') {
        $where[] = '`household_code` <> :exclude_household_code';
        $params['exclude_household_code'] = $excludeHouseholdCode;
    }
    $where[] = '`household_code` LIKE :year_prefix';
    $params['year_prefix'] = "HH-{$targetYear}-%";
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
        $existingHead = reg_json_decode_assoc((string) ($row['head_data_json'] ?? ''));
        $existingIdentity = reg_household_identity($existingHead);
        if ($existingIdentity === '' || $existingIdentity !== $identity) {
            continue;
        }
        return [
            'household_id' => (string) ($row['household_code'] ?? ''),
            'head_name' => (string) ($row['head_name'] ?? ''),
            'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
            'year' => $targetYear,
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

    $head = is_array($record['head'] ?? null) ? $record['head'] : [];
    $head = reg_normalize_person_text_fields($head);

    $members = [];
    foreach (reg_normalize_members($record['members'] ?? []) as $memberRow) {
        $members[] = reg_normalize_person_text_fields($memberRow);
    }
    if (count($members) === 0) {
        throw new InvalidArgumentException('At least one household member is required.');
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
    $head['zone'] = $zone;

    foreach ($members as $index => $member) {
        if (!is_array($member)) {
            continue;
        }
        $memberZone = reg_normalize_zone_text($member['zone'] ?? $zone);
        if ($memberZone === '') {
            $memberZone = $zone;
        }
        $member['zone'] = $memberZone;
        $members[$index] = $member;
    }
    $source = reg_text($record['source'] ?? 'registration-module', 80);
    $memberCount = max(1, count($members) + 1);
    $actorUserId = (int) ($authUser['id'] ?? 0);
    $syncedAt = gmdate('c');

    $recordForStore = [
        'household_id' => $householdCode,
        'mode' => reg_text($record['mode'] ?? 'update', 20),
        'source' => $source,
        'head' => $head,
        'members' => $members,
        'head_name' => $headName,
        'zone' => $zone,
        'member_count' => $memberCount,
        'updated_at' => $syncedAt,
        'server_synced_at' => $syncedAt,
    ];

    $pdo->beginTransaction();
    try {
        $findStmt = $pdo->prepare(
            'SELECT `id` FROM `registration_households`
             WHERE `household_code` = :household_code
             LIMIT 1 FOR UPDATE'
        );
        $findStmt->execute(['household_code' => $householdCode]);
        $existing = $findStmt->fetch(PDO::FETCH_ASSOC);
        $householdDbId = is_array($existing) ? (int) ($existing['id'] ?? 0) : 0;

        if ($householdDbId > 0) {
            $updateStmt = $pdo->prepare(
                'UPDATE `registration_households`
                 SET `source` = :source,
                     `head_name` = :head_name,
                     `zone` = :zone,
                     `member_count` = :member_count,
                     `head_data_json` = :head_data_json,
                     `members_data_json` = :members_data_json,
                     `record_data_json` = :record_data_json,
                     `updated_by_user_id` = :updated_by_user_id,
                     `updated_at` = CURRENT_TIMESTAMP
                 WHERE `id` = :id LIMIT 1'
            );
            $updateStmt->execute([
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
                 (`household_code`, `source`, `head_name`, `zone`, `member_count`,
                  `head_data_json`, `members_data_json`, `record_data_json`, `created_by_user_id`, `updated_by_user_id`)
                 VALUES
                 (:household_code, :source, :head_name, :zone, :member_count,
                  :head_data_json, :members_data_json, :record_data_json, :created_by_user_id, :updated_by_user_id)'
            );
            $insertStmt->execute([
                'household_code' => $householdCode,
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
             (`resident_code`, `household_id`, `household_code`, `source_type`, `member_order`,
              `full_name`, `relation_to_head`, `sex`, `age`, `zone`, `resident_data_json`)
             VALUES
             (:resident_code, :household_id, :household_code, :source_type, :member_order,
              :full_name, :relation_to_head, :sex, :age, :zone, :resident_data_json)'
        );

        $headResidentCode = $existingHeadResidentCode !== ''
            ? $existingHeadResidentCode
            : reg_next_resident_code($pdo, $householdCode);
        $insertResident->execute([
            'resident_code' => $headResidentCode,
            'household_id' => $householdDbId,
            'household_code' => $householdCode,
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
             (`household_id`, `household_code`, `resident_code`, `member_order`,
              `full_name`, `relation_to_head`, `sex`, `age`, `zone`, `member_data_json`)
             VALUES
             (:household_id, :household_code, :resident_code, :member_order,
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

        $pdo->commit();
        return [
            'household_id' => $householdCode,
            'synced_at' => $syncedAt,
            'total_records' => reg_total_households($pdo),
        ];
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

auth_bootstrap_store();
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$requestAction = strtolower(reg_text($_GET['action'] ?? '', 40));
$captainReadableActions = ['', 'list_households', 'get_household', 'list_residents', 'get_resident'];
$allowCaptainReadOnly = $requestMethod === 'GET' && in_array($requestAction, $captainReadableActions, true);
$allowedRoles = [AUTH_ROLE_STAFF, AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY];
if ($allowCaptainReadOnly) {
    $allowedRoles[] = AUTH_ROLE_CAPTAIN;
}

$authUser = auth_require_api($allowedRoles);
$pdo = auth_db();
auth_ensure_users_columns($pdo);
reg_bootstrap_tables($pdo);

function reg_list_households(PDO $pdo): array
{
    $limit = max(1, min(500, (int) ($_GET['limit'] ?? 100)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $zone = reg_text($_GET['zone'] ?? '', 80);
    $q = reg_text($_GET['q'] ?? '', 120);

    $sql = 'SELECT `household_code`, `head_name`, `zone`, `member_count`, `source`, `created_at`, `updated_at`
            FROM `registration_households`
            WHERE 1=1';
    $params = [];
    if ($zone !== '') {
        $sql .= ' AND `zone` = :zone';
        $params['zone'] = $zone;
    }
    if ($q !== '') {
        $sql .= ' AND (`household_code` LIKE :q OR `head_name` LIKE :q)';
        $params['q'] = '%' . $q . '%';
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return [
        'items' => array_map(static fn(array $row): array => [
            'household_id' => (string) ($row['household_code'] ?? ''),
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
}

function reg_get_household(PDO $pdo, string $householdCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `household_code`, `head_name`, `zone`, `member_count`, `source`,
                `head_data_json`, `members_data_json`, `record_data_json`, `created_at`, `updated_at`
         FROM `registration_households`
         WHERE `household_code` = :household_code
         LIMIT 1'
    );
    $stmt->execute(['household_code' => $householdCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return null;
    }

    $record = reg_json_decode_assoc((string) ($row['record_data_json'] ?? ''));
    $record['household_id'] = (string) ($row['household_code'] ?? $householdCode);
    $record['head_name'] = (string) ($row['head_name'] ?? ($record['head_name'] ?? ''));
    $record['zone'] = reg_normalize_zone_text($row['zone'] ?? ($record['zone'] ?? ''));
    $record['member_count'] = (int) ($row['member_count'] ?? ($record['member_count'] ?? 0));
    $record['source'] = (string) ($row['source'] ?? ($record['source'] ?? 'registration-module'));
    $record['head'] = reg_strip_health_fields(reg_json_decode_assoc((string) ($row['head_data_json'] ?? '')));
    $record['members'] = array_map(
        static fn (array $member): array => reg_strip_health_fields($member),
        reg_normalize_members(reg_json_decode_assoc((string) ($row['members_data_json'] ?? '')))
    );
    if (!is_array($record['members']) || count($record['members']) === 0) {
        $membersStmt = $pdo->prepare(
            'SELECT `member_data_json`
             FROM `registration_members`
             WHERE `household_id` = :household_id
             ORDER BY `member_order` ASC'
        );
        $membersStmt->execute(['household_id' => (int) ($row['id'] ?? 0)]);
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
        'head_name' => (string) ($row['head_name'] ?? ''),
        'zone' => reg_normalize_zone_text($row['zone'] ?? ''),
        'member_count' => (int) ($row['member_count'] ?? 0),
        'source' => (string) ($row['source'] ?? ''),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'record' => $record,
    ];
}

function reg_list_members(PDO $pdo): array
{
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 300)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $householdCode = reg_text($_GET['household_id'] ?? '', 64);
    $q = reg_text($_GET['q'] ?? '', 120);

    $sql = 'SELECT `resident_code`, `household_code`, `member_order`, `full_name`, `relation_to_head`,
                   `sex`, `age`, `zone`, `updated_at`, `member_data_json`
            FROM `registration_members`
            WHERE 1=1';
    $params = [];
    if ($householdCode !== '') {
        $sql .= ' AND `household_code` = :household_code';
        $params['household_code'] = $householdCode;
    }
    if ($q !== '') {
        $sql .= ' AND (`resident_code` LIKE :q OR `full_name` LIKE :q)';
        $params['q'] = '%' . $q . '%';
    }
    $sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return [
        'items' => array_map(static fn(array $row): array => [
            'resident_id' => (string) ($row['resident_code'] ?? ''),
            'household_id' => (string) ($row['household_code'] ?? ''),
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
        'SELECT `resident_code`, `household_code`, `member_order`, `full_name`, `relation_to_head`,
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

function reg_list_residents(PDO $pdo): array
{
    $limit = max(1, min(1000, (int) ($_GET['limit'] ?? 300)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $householdCode = reg_text($_GET['household_id'] ?? '', 64);
    $zone = reg_text($_GET['zone'] ?? '', 80);
    $q = reg_text($_GET['q'] ?? '', 120);

    $sql = 'SELECT `resident_code`, `household_code`, `source_type`, `member_order`, `full_name`,
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
        $sql .= ' AND (`resident_code` LIKE :q OR `full_name` LIKE :q)';
        $params['q'] = '%' . $q . '%';
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
            $profileRaw = is_array($profile) ? $profile : [];
            $pwd = (string) ($profileRaw['pwd'] ?? ($profileRaw['health_has_disability'] ?? ''));
            $pregnant = (string) ($profileRaw['pregnant'] ?? ($profileRaw['health_maternal_pregnant'] ?? ''));
            $profile = reg_strip_health_fields($profileRaw);

            return [
                'resident_id' => (string) ($row['resident_code'] ?? ''),
                'household_id' => (string) ($row['household_code'] ?? ''),
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
        }, $rows),
        'count' => count($rows),
        'limit' => $limit,
        'offset' => $offset,
    ];
}

function reg_get_resident(PDO $pdo, string $residentCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `resident_code`, `household_code`, `source_type`, `member_order`, `full_name`,
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
    if (is_array($resident)) {
        $profile = is_array($resident['member'] ?? null)
            ? $resident['member']
            : (is_array($resident['head'] ?? null) ? $resident['head'] : $resident);
        if (is_array($profile)) {
            $profile = reg_strip_health_fields($profile);
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

    return [
        'resident_id' => (string) ($row['resident_code'] ?? ''),
        'household_id' => (string) ($row['household_code'] ?? ''),
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

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM `registration_members` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);
        $pdo->prepare('DELETE FROM `registration_residents` WHERE `household_id` = :household_id')
            ->execute(['household_id' => $householdDbId]);
        $pdo->prepare('DELETE FROM `registration_households` WHERE `id` = :id LIMIT 1')
            ->execute(['id' => $householdDbId]);
        $pdo->commit();
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
    $stmt = $pdo->prepare('SELECT `id`, `household_id` FROM `registration_members` WHERE `resident_code` = :resident_code LIMIT 1');
    $stmt->execute(['resident_code' => $residentCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return false;
    }

    $memberId = (int) ($row['id'] ?? 0);
    $householdDbId = (int) ($row['household_id'] ?? 0);
    if ($memberId <= 0 || $householdDbId <= 0) {
        return false;
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM `registration_members` WHERE `id` = :id LIMIT 1')
            ->execute(['id' => $memberId]);
        $pdo->prepare('DELETE FROM `registration_residents` WHERE `resident_code` = :resident_code AND `source_type` = "member" LIMIT 1')
            ->execute(['resident_code' => $residentCode]);
        $pdo->prepare('UPDATE `registration_households` SET `member_count` = GREATEST(1, `member_count` - 1), `updated_at` = CURRENT_TIMESTAMP WHERE `id` = :id LIMIT 1')
            ->execute(['id' => $householdDbId]);
        $pdo->commit();
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
    if ($csrfToken !== '' && !auth_csrf_valid($csrfToken)) {
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
        $duplicate = reg_find_duplicate_household($pdo, $record, $householdCode);
        if (is_array($duplicate)) {
            $duplicateYear = reg_text($duplicate['year'] ?? '', 10);
            $message = $duplicateYear !== ''
                ? "Household already exists for {$duplicateYear}. Do you want to replace this household?"
                : 'Household already exists. Do you want to replace this household?';
            reg_respond(409, [
                'success' => false,
                'code' => 'duplicate_household',
                'error' => $message,
                'duplicate' => $duplicate,
            ]);
        }
        $wasExisting = reg_household_exists($pdo, $householdCode);
        $memberRows = reg_normalize_members($record['members'] ?? []);
        try {
            $result = reg_upsert_household($pdo, $record, $authUser);
        } catch (InvalidArgumentException $exception) {
            reg_error(422, reg_text($exception->getMessage(), 220));
        }
        reg_audit_log(
            $authUser,
            $wasExisting ? 'registration_household_updated' : 'registration_household_created',
            $wasExisting ? 'updated' : 'created',
            $wasExisting ? 'Updated household record.' : 'Created household record.',
            'household',
            $householdCode,
            [
                'member_rows' => count($memberRows),
                'source' => reg_text($record['source'] ?? '', 80),
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
} catch (Throwable $exception) {
    reg_error(500, 'Unable to process registration request right now.');
}
