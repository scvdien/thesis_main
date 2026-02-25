<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/**
 * @param array<string, mixed> $payload
 */
function dash_api_respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function dash_api_error(int $statusCode, string $message): never
{
    dash_api_respond($statusCode, [
        'success' => false,
        'error' => $message,
    ]);
}

function dash_text(mixed $value, int $maxLength = 255): string
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

/**
 * @return array<string, mixed>
 */
function dash_json_decode_assoc(?string $json): array
{
    if (!is_string($json) || trim($json) === '') {
        return [];
    }
    $decoded = json_decode($json, true);
    return is_array($decoded) ? $decoded : [];
}

function dash_table_exists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
         LIMIT 1'
    );
    $stmt->execute(['table_name' => $tableName]);
    return (bool) $stmt->fetchColumn();
}

function dash_parse_year(mixed $value): int
{
    $year = (int) gmdate('Y');
    if (is_numeric($value)) {
        $parsed = (int) $value;
        if ($parsed >= 2000 && $parsed <= 2100) {
            return $parsed;
        }
    }
    return $year;
}

function dash_is_yes(mixed $value): bool
{
    $normalized = strtolower(dash_text($value, 40));
    return in_array($normalized, ['1', 'yes', 'y', 'true', 't', 'oo', 'on'], true);
}

function dash_to_int(mixed $value): ?int
{
    if (is_int($value)) {
        return $value >= 0 ? $value : null;
    }
    if (is_float($value)) {
        return $value >= 0 ? (int) round($value) : null;
    }
    $text = dash_text($value, 40);
    if ($text === '' || preg_match('/^\d+$/', $text) !== 1) {
        return null;
    }
    return (int) $text;
}

function dash_normalize_gender(mixed $value): string
{
    $normalized = strtolower(dash_text($value, 40));
    return match ($normalized) {
        'm', 'male', 'lalaki' => 'Male',
        'f', 'female', 'babae' => 'Female',
        default => 'Other',
    };
}

function dash_normalize_civil_status(mixed $value): string
{
    $normalized = strtolower(dash_text($value, 60));
    return match ($normalized) {
        'single', 'soltero', 'dalaga' => 'Single',
        'married', 'kasal' => 'Married',
        'widowed', 'widow', 'widower', 'balo' => 'Widowed',
        'separated', 'hiwalay', 'annulled', 'annul' => 'Separated',
        default => $normalized === '' ? 'Other' : ucfirst($normalized),
    };
}

function dash_normalize_education(mixed $value, bool $isDropout): string
{
    $normalized = strtolower(dash_text($value, 120));
    if ($isDropout) {
        return 'Not Finished';
    }
    if ($normalized === '' || $normalized === 'none' || $normalized === 'no schooling') {
        return 'No Schooling';
    }
    if (str_contains($normalized, 'elementary') || str_contains($normalized, 'primary')) {
        return 'Elementary';
    }
    if (
        str_contains($normalized, 'high school')
        || str_contains($normalized, 'secondary')
        || str_contains($normalized, 'senior high')
        || str_contains($normalized, 'junior high')
    ) {
        return 'High School';
    }
    if (
        str_contains($normalized, 'college')
        || str_contains($normalized, 'bachelor')
        || str_contains($normalized, 'undergraduate')
        || preg_match('/\bbs\b|\bba\b/', $normalized) === 1
    ) {
        return 'College';
    }
    if (str_contains($normalized, 'vocational') || str_contains($normalized, 'tesda') || str_contains($normalized, 'tech')) {
        return 'Vocational';
    }
    return 'Not Finished';
}

function dash_normalize_employment(mixed $value): string
{
    $normalized = strtolower(dash_text($value, 120));
    if ($normalized === '' || $normalized === 'none' || str_contains($normalized, 'unemploy')) {
        return 'Unemployed';
    }
    if (str_contains($normalized, 'self')) {
        return 'Self-Employed';
    }
    if (str_contains($normalized, 'retired') || str_contains($normalized, 'pension')) {
        return 'Retired';
    }
    if (str_contains($normalized, 'employ')) {
        return 'Employed';
    }
    return ucfirst($normalized);
}

function dash_age_bucket_ten(?int $age): ?string
{
    if ($age === null || $age < 0) {
        return null;
    }
    return match (true) {
        $age <= 5 => '0-5',
        $age <= 10 => '6-10',
        $age <= 15 => '11-15',
        $age <= 20 => '16-20',
        $age <= 30 => '21-30',
        $age <= 40 => '31-40',
        $age <= 50 => '41-50',
        $age <= 60 => '51-60',
        $age <= 70 => '61-70',
        default => '71+',
    };
}

function dash_age_bucket_five(?int $age): ?string
{
    if ($age === null || $age < 0) {
        return null;
    }
    return match (true) {
        $age <= 5 => '0-5',
        $age <= 12 => '6-12',
        $age <= 17 => '13-17',
        $age <= 59 => '18-59',
        default => '60+',
    };
}

/**
 * @param array<string, int> $bucket
 */
function dash_increment(array &$bucket, string $key, int $step = 1): void
{
    if (!isset($bucket[$key])) {
        $bucket[$key] = 0;
    }
    $bucket[$key] += $step;
}

function dash_clean_label(mixed $value, int $maxLength = 120): string
{
    return dash_text($value, $maxLength);
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function dash_extract_resident_profile(array $row): array
{
    $json = dash_json_decode_assoc((string) ($row['resident_data_json'] ?? ''));
    $sourceType = strtolower(dash_text($row['source_type'] ?? '', 20));
    if ($sourceType === 'head' && is_array($json['head'] ?? null)) {
        return $json['head'];
    }
    if ($sourceType === 'member' && is_array($json['member'] ?? null)) {
        return $json['member'];
    }
    if (is_array($json['head'] ?? null)) {
        return $json['head'];
    }
    if (is_array($json['member'] ?? null)) {
        return $json['member'];
    }
    return is_array($json) ? $json : [];
}

/**
 * @param array<string, mixed> $profile
 */
function dash_extract_age(array $profile, mixed $fallbackAge): ?int
{
    $profileAge = dash_to_int($profile['age'] ?? null);
    if ($profileAge !== null) {
        return $profileAge;
    }
    $rowAge = dash_to_int($fallbackAge);
    if ($rowAge !== null) {
        return $rowAge;
    }
    $birthday = dash_text($profile['birthday'] ?? '', 20);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday) !== 1) {
        return null;
    }
    try {
        $birthDate = new DateTimeImmutable($birthday);
        $today = new DateTimeImmutable('today');
        $diff = $today->diff($birthDate);
        $years = (int) ($diff->format('%r%y'));
        return $years >= 0 ? $years : null;
    } catch (Throwable) {
        return null;
    }
}

/**
 * @return array<int, int>
 */
function dash_available_years(PDO $pdo): array
{
    $years = [];
    $tables = ['registration_residents', 'registration_households'];
    foreach ($tables as $table) {
        if (!dash_table_exists($pdo, $table)) {
            continue;
        }
        $stmt = $pdo->query(
            'SELECT DISTINCT YEAR(`created_at`) AS `year`
             FROM `' . $table . '`
             WHERE `created_at` IS NOT NULL'
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $year = (int) ($row['year'] ?? 0);
            if ($year >= 2000 && $year <= 2100) {
                $years[] = $year;
            }
        }
    }
    $years[] = (int) gmdate('Y');
    $years = array_values(array_unique($years));
    sort($years);
    return $years;
}

/**
 * @param array<string, mixed> $map
 * @return array<string, int>
 */
function dash_sort_counts(array $map): array
{
    $normalized = [];
    foreach ($map as $key => $value) {
        $normalized[(string) $key] = max(0, (int) $value);
    }
    arsort($normalized);
    return $normalized;
}

/**
 * @return array<string, mixed>
 */
function dash_build_analytics(PDO $pdo, int $year): array
{
    $ageBrackets = [
        '0-5' => 0,
        '6-10' => 0,
        '11-15' => 0,
        '16-20' => 0,
        '21-30' => 0,
        '31-40' => 0,
        '41-50' => 0,
        '51-60' => 0,
        '61-70' => 0,
        '71+' => 0,
    ];
    $ageFiveBrackets = [
        '0-5' => 0,
        '6-12' => 0,
        '13-17' => 0,
        '18-59' => 0,
        '60+' => 0,
    ];
    $genderCounts = [
        'Male' => 0,
        'Female' => 0,
        'Other' => 0,
    ];
    $civilStatusCounts = [
        'Single' => 0,
        'Married' => 0,
        'Widowed' => 0,
        'Separated' => 0,
        'Other' => 0,
    ];
    $employmentCounts = [
        'Employed' => 0,
        'Unemployed' => 0,
        'Self-Employed' => 0,
    ];
    $educationCounts = [
        'No Schooling' => 0,
        'Elementary' => 0,
        'High School' => 0,
        'College' => 0,
        'Vocational' => 0,
        'Not Finished' => 0,
    ];
    $otherIndicators = [
        'PWD' => 0,
        'Senior Citizens' => 0,
        'Solo Parents' => 0,
    ];
    $householdSize = [
        '1-2 Members' => 0,
        '3-5 Members' => 0,
        '6+ Members' => 0,
    ];
    $toiletCounts = [];
    $waterCounts = [];
    $electricityCounts = [];
    $ownershipCounts = [];
    $deathsByCause = [];

    $pregnantWomen = 0;
    $malnourishedChildren = 0;
    $personsWithIllness = 0;
    $totalPopulation = 0;
    $residentHouseholdCodes = [];

    $residentRows = [];
    if (dash_table_exists($pdo, 'registration_residents')) {
        $residentStmt = $pdo->prepare(
            'SELECT `household_code`, `source_type`, `sex`, `age`, `relation_to_head`, `resident_data_json`, `created_at`
             FROM `registration_residents`
             WHERE YEAR(`created_at`) = :year'
        );
        $residentStmt->execute(['year' => $year]);
        $residentRows = $residentStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    foreach ($residentRows as $residentRow) {
        if (!is_array($residentRow)) {
            continue;
        }
        $totalPopulation += 1;
        $householdCode = dash_text($residentRow['household_code'] ?? '', 64);
        if ($householdCode !== '') {
            $residentHouseholdCodes[$householdCode] = true;
        }

        $profile = dash_extract_resident_profile($residentRow);
        $gender = dash_normalize_gender($profile['sex'] ?? ($residentRow['sex'] ?? ''));
        dash_increment($genderCounts, $gender);

        $age = dash_extract_age($profile, $residentRow['age'] ?? null);
        $ageTenKey = dash_age_bucket_ten($age);
        if ($ageTenKey !== null) {
            dash_increment($ageBrackets, $ageTenKey);
        }
        $ageFiveKey = dash_age_bucket_five($age);
        if ($ageFiveKey !== null) {
            dash_increment($ageFiveBrackets, $ageFiveKey);
        }

        $civilStatus = dash_normalize_civil_status($profile['civil_status'] ?? '');
        if (!isset($civilStatusCounts[$civilStatus])) {
            $civilStatus = 'Other';
        }
        dash_increment($civilStatusCounts, $civilStatus);

        $employment = dash_normalize_employment($profile['employment_status'] ?? '');
        dash_increment($employmentCounts, $employment);

        $education = dash_normalize_education(
            $profile['education'] ?? '',
            dash_is_yes($profile['dropout'] ?? 'No')
        );
        dash_increment($educationCounts, $education);

        if (dash_is_yes($profile['pwd'] ?? 'No')) {
            dash_increment($otherIndicators, 'PWD');
        }
        if (($age !== null && $age >= 60) || dash_is_yes($profile['senior'] ?? 'No')) {
            dash_increment($otherIndicators, 'Senior Citizens');
        }
        $numChildren = dash_to_int($profile['num_children'] ?? null) ?? 0;
        if (
            $numChildren > 0
            && in_array($civilStatus, ['Single', 'Separated', 'Widowed'], true)
        ) {
            dash_increment($otherIndicators, 'Solo Parents');
        }

        $isFemale = $gender === 'Female';
        if (
            $isFemale
            && (
                dash_is_yes($profile['pregnant'] ?? 'No')
                || dash_is_yes($profile['health_maternal_pregnant'] ?? 'No')
            )
        ) {
            $pregnantWomen += 1;
        }
        if (dash_is_yes($profile['health_child_malnutrition'] ?? 'No')) {
            $malnourishedChildren += 1;
        }
        if (dash_is_yes($profile['health_current_illness'] ?? 'No')) {
            $personsWithIllness += 1;
        }
        if (dash_is_yes($profile['deceased'] ?? 'No')) {
            $cause = dash_clean_label($profile['death_cause'] ?? $profile['cause_of_death'] ?? '', 120);
            if ($cause === '') {
                $cause = 'Unspecified';
            }
            dash_increment($deathsByCause, $cause);
        }
    }

    $householdRows = [];
    if (dash_table_exists($pdo, 'registration_households')) {
        $householdStmt = $pdo->prepare(
            'SELECT `household_code`, `member_count`, `head_data_json`, `created_at`
             FROM `registration_households`
             WHERE YEAR(`created_at`) = :year'
        );
        $householdStmt->execute(['year' => $year]);
        $householdRows = $householdStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    foreach ($householdRows as $householdRow) {
        if (!is_array($householdRow)) {
            continue;
        }

        $memberCount = dash_to_int($householdRow['member_count'] ?? null) ?? 0;
        if ($memberCount <= 2) {
            dash_increment($householdSize, '1-2 Members');
        } elseif ($memberCount <= 5) {
            dash_increment($householdSize, '3-5 Members');
        } else {
            dash_increment($householdSize, '6+ Members');
        }

        $head = dash_json_decode_assoc((string) ($householdRow['head_data_json'] ?? ''));
        $toilet = dash_clean_label($head['toilet'] ?? '', 150);
        if ($toilet !== '') {
            dash_increment($toiletCounts, $toilet);
        }
        $water = dash_clean_label($head['water'] ?? '', 150);
        if ($water !== '') {
            dash_increment($waterCounts, $water);
        }
        $electricity = dash_clean_label($head['electricity'] ?? '', 80);
        if ($electricity !== '') {
            dash_increment($electricityCounts, $electricity);
        }
        $ownership = dash_clean_label($head['ownership'] ?? '', 120);
        if ($ownership !== '') {
            dash_increment($ownershipCounts, $ownership);
        }
    }

    $totalHouseholds = count($householdRows);
    if ($totalHouseholds === 0) {
        $totalHouseholds = count($residentHouseholdCodes);
    }
    $averageHouseholdSize = $totalHouseholds > 0
        ? round($totalPopulation / $totalHouseholds, 2)
        : 0.0;

    return [
        'year' => $year,
        'population_summary' => [
            'total_population' => $totalPopulation,
            'male' => $genderCounts['Male'] ?? 0,
            'female' => $genderCounts['Female'] ?? 0,
            'households' => $totalHouseholds,
            'average_household_size' => $averageHouseholdSize,
        ],
        'gender_distribution' => $genderCounts,
        'age_brackets' => $ageBrackets,
        'age_group_distribution' => $ageFiveBrackets,
        'civil_status_distribution' => $civilStatusCounts,
        'household_size_distribution' => $householdSize,
        'socio_economic' => [
            'employment_status' => dash_sort_counts($employmentCounts),
            'educational_attainment' => dash_sort_counts($educationCounts),
            'other_indicators' => $otherIndicators,
        ],
        'housing_utilities' => [
            'toilet_type' => dash_sort_counts($toiletCounts),
            'water_source' => dash_sort_counts($waterCounts),
            'electricity_source' => dash_sort_counts($electricityCounts),
            'housing_ownership' => dash_sort_counts($ownershipCounts),
        ],
        'health_risk' => [
            'pregnant_women' => $pregnantWomen,
            'malnourished_children' => $malnourishedChildren,
            'persons_with_illness' => $personsWithIllness,
            'deaths_by_cause' => dash_sort_counts($deathsByCause),
        ],
    ];
}

auth_bootstrap_store();
$authUser = auth_require_api([AUTH_ROLE_CAPTAIN, AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY]);
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($requestMethod !== 'GET') {
    dash_api_error(405, 'Method not allowed.');
}

try {
    $year = dash_parse_year($_GET['year'] ?? gmdate('Y'));
    $pdo = auth_db();
    auth_ensure_users_columns($pdo);

    $payload = dash_build_analytics($pdo, $year);
    dash_api_respond(200, [
        'success' => true,
        'data' => $payload,
        'meta' => [
            'available_years' => dash_available_years($pdo),
            'generated_at' => gmdate('c'),
            'requested_by' => [
                'id' => (int) ($authUser['id'] ?? 0),
                'role' => (string) ($authUser['role'] ?? ''),
            ],
        ],
    ]);
} catch (Throwable $exception) {
    error_log('dashboard-analytics-api.php failed: ' . $exception->getMessage());
    dash_api_error(500, 'Unable to load dashboard analytics right now.');
}

