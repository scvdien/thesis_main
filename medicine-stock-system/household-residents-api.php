<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

if (mss_api_request_method() !== 'GET') {
    mss_api_error('Method not allowed.', 405);
}

/**
 * @return array<string, mixed>
 */
function mss_household_resident_json_decode_assoc(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * @param array<string, mixed> $resident
 * @return array<string, mixed>
 */
function mss_household_resident_profile(array $resident): array
{
    $profile = $resident['member'] ?? $resident['head'] ?? $resident;
    return is_array($profile) ? $profile : [];
}

function mss_household_resident_text(mixed $value, int $maxLength = 255): string
{
    $text = trim((string) $value);
    $text = preg_replace('/[\x00-\x1F\x7F]/u', '', $text);
    if (!is_string($text)) {
        $text = trim((string) $value);
    }
    if (strlen($text) > $maxLength) {
        $text = substr($text, 0, $maxLength);
    }
    return $text;
}

function mss_household_resident_zone(mixed $value): string
{
    $text = mss_household_resident_text($value, 80);
    if ($text === '') {
        return '';
    }

    $compact = preg_replace('/\s+/u', ' ', $text);
    if (!is_string($compact) || $compact === '') {
        return '';
    }

    if (preg_match('/^(?:zone|purok)\s*([[:alnum:]-]+)$/iu', $compact, $matches) === 1) {
        $suffix = mss_household_resident_text($matches[1] ?? '', 30);
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

function mss_household_residents_table_exists(PDO $pdo): bool
{
    $query = $pdo->query("SHOW TABLES LIKE 'registration_residents'");
    return $query !== false && $query->fetchColumn() !== false;
}

$pdo = mss_api_bootstrap(true);

if (!mss_household_residents_table_exists($pdo)) {
    mss_api_respond([
        'success' => true,
        'data' => [
            'items' => [],
            'count' => 0,
            'limit' => 0,
            'offset' => 0,
        ],
    ]);
}

$limit = max(1, min(500, (int) ($_GET['limit'] ?? 250)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));
$zone = mss_household_resident_text($_GET['zone'] ?? '', 80);
$queryText = mss_household_resident_text($_GET['q'] ?? '', 120);

$sql = 'SELECT `resident_code`, `household_code`, `record_year`, `source_type`, `member_order`, `full_name`,
               `relation_to_head`, `sex`, `age`, `zone`, `updated_at`, `resident_data_json`
        FROM `registration_residents`
        WHERE 1=1';
$params = [];

if ($zone !== '') {
    $sql .= ' AND `zone` = :zone';
    $params['zone'] = $zone;
}

if ($queryText !== '') {
    $sql .= ' AND (
        `resident_code` LIKE :q_resident_code
        OR `household_code` LIKE :q_household_code
        OR `full_name` LIKE :q_full_name
    )';
    $params['q_resident_code'] = '%' . $queryText . '%';
    $params['q_household_code'] = '%' . $queryText . '%';
    $params['q_full_name'] = '%' . $queryText . '%';
}

$sql .= ' ORDER BY `updated_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $exception) {
    mss_api_error('Unable to load household residents right now.', 500);
}

$items = array_map(static function (array $row): array {
    $resident = mss_household_resident_json_decode_assoc($row['resident_data_json'] ?? '');
    $profile = mss_household_resident_profile($resident);

    return [
        'resident_id' => mss_household_resident_text($row['resident_code'] ?? '', 64),
        'household_id' => mss_household_resident_text($row['household_code'] ?? '', 64),
        'record_year' => (int) ($row['record_year'] ?? 0),
        'source_type' => mss_household_resident_text($row['source_type'] ?? '', 20),
        'member_order' => (int) ($row['member_order'] ?? 0),
        'full_name' => mss_household_resident_text($row['full_name'] ?? ($profile['full_name'] ?? ''), 220),
        'relation_to_head' => mss_household_resident_text($row['relation_to_head'] ?? '', 120),
        'sex' => mss_household_resident_text($row['sex'] ?? ($profile['sex'] ?? ''), 20),
        'age' => mss_household_resident_text($row['age'] ?? ($profile['age'] ?? ''), 20),
        'zone' => mss_household_resident_zone($profile['zone'] ?? ($row['zone'] ?? '')),
        'barangay' => mss_household_resident_text($profile['barangay'] ?? 'Cabarian', 120) ?: 'Cabarian',
        'city' => mss_household_resident_text($profile['city'] ?? 'Ligao City', 120) ?: 'Ligao City',
        'province' => mss_household_resident_text($profile['province'] ?? 'Albay', 120) ?: 'Albay',
        'address' => mss_household_resident_text($profile['address'] ?? '', 255),
        'updated_at' => mss_household_resident_text($row['updated_at'] ?? '', 40),
    ];
}, $rows);

mss_api_respond([
    'success' => true,
    'data' => [
        'items' => $items,
        'count' => count($items),
        'limit' => $limit,
        'offset' => $offset,
    ],
]);
