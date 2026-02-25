<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

auth_require_api(['captain', 'admin', 'secretary']);

function respondWithError(int $statusCode, string $message): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clearOutputBuffers(): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
}

function text($value, int $max = 2000): string
{
    $v = trim((string) $value);
    $v = preg_replace('/[\x00-\x1F\x7F]/', '', $v);
    if ($v === null) {
        $v = trim((string) $value);
    }
    if (strlen($v) > $max) {
        $v = substr($v, 0, $max);
    }
    return $v;
}

function esc($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function toPdfText($value): string
{
    $txt = (string) $value;
    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $txt);
        if ($converted !== false) {
            return $converted;
        }
    }
    return $txt;
}

function parseSelectedYear($value): int
{
    $current = (int) date('Y');
    if (is_numeric($value)) {
        $year = (int) $value;
        if ($year >= 2000 && $year <= 2100) {
            return $year;
        }
    }
    $txt = text($value, 20);
    if (preg_match('/\b(19|20)\d{2}\b/', $txt, $m) === 1) {
        $year = (int) $m[0];
        if ($year >= 2000 && $year <= 2100) {
            return $year;
        }
    }
    return $current;
}

function envValue(array $keys, string $default = ''): string
{
    foreach ($keys as $k) {
        if (isset($_ENV[$k]) && trim((string) $_ENV[$k]) !== '') {
            return trim((string) $_ENV[$k]);
        }
        if (isset($_SERVER[$k]) && trim((string) $_SERVER[$k]) !== '') {
            return trim((string) $_SERVER[$k]);
        }
        $v = getenv($k);
        if ($v !== false && trim((string) $v) !== '') {
            return trim((string) $v);
        }
    }
    return $default;
}

function qid(string $identifier): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException('Invalid identifier: ' . $identifier);
    }
    return '`' . $identifier . '`';
}

function dbConnection(): ?PDO
{
    if (!class_exists('PDO')) {
        return null;
    }
    $host = envValue(['DB_HOST'], '127.0.0.1');
    $port = envValue(['DB_PORT'], '3306');
    $user = envValue(['DB_USERNAME', 'DB_USER'], 'root');
    $pass = envValue(['DB_PASSWORD', 'DB_PASS'], '');
    $dbNames = array_values(array_unique(array_filter([
        envValue(['DB_NAME'], 'thesis_main'),
        'thesis_main',
        'barangay_hims',
        'hims',
        'thesis',
    ])));
    $opt = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    foreach ($dbNames as $db) {
        try {
            return new PDO("mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4", $user, $pass, $opt);
        } catch (Throwable $e) {
            // try next db
        }
    }
    return null;
}

function firstExistingTable(PDO $pdo, array $candidates): ?string
{
    $stmt = $pdo->prepare(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :name LIMIT 1'
    );
    foreach ($candidates as $name) {
        $stmt->execute(['name' => $name]);
        $found = $stmt->fetchColumn();
        if (is_string($found) && $found !== '') {
            return $found;
        }
    }
    return null;
}

function tableColumns(PDO $pdo, string $table): array
{
    $stmt = $pdo->prepare(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
    );
    $stmt->execute(['table' => $table]);
    $cols = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $col) {
        if (is_string($col) && $col !== '') {
            $cols[] = $col;
        }
    }
    return $cols;
}

function pickColumn(array $columns, array $candidates): ?string
{
    $lookup = [];
    foreach ($columns as $c) {
        $lookup[strtolower($c)] = $c;
    }
    foreach ($candidates as $candidate) {
        $k = strtolower($candidate);
        if (isset($lookup[$k])) {
            return $lookup[$k];
        }
    }
    return null;
}

function parseYearValue($value): ?int
{
    $txt = text($value, 60);
    if ($txt === '') {
        return null;
    }
    if (preg_match('/\b(19|20)\d{2}\b/', $txt, $m) === 1) {
        return (int) $m[0];
    }
    $ts = strtotime($txt);
    if ($ts === false) {
        return null;
    }
    return (int) date('Y', $ts);
}

function fetchRowsByYear(PDO $pdo, string $table, array $columns, ?string $yearColumn, int $year): array
{
    $selected = [];
    foreach ($columns as $c) {
        if (is_string($c) && $c !== '') {
            $selected[$c] = true;
        }
    }
    if ($yearColumn) {
        $selected[$yearColumn] = true;
    }
    if (!$selected) {
        return [];
    }
    $names = array_keys($selected);
    $quoted = [];
    foreach ($names as $n) {
        $quoted[] = qid($n);
    }
    $sql = 'SELECT ' . implode(', ', $quoted) . ' FROM ' . qid($table);
    if ($yearColumn) {
        try {
            $stmt = $pdo->prepare($sql . ' WHERE YEAR(' . qid($yearColumn) . ') = :year');
            $stmt->execute(['year' => $year]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            // fallback to app-side year filtering
        }
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (!$yearColumn) {
        return $rows;
    }
    $filtered = [];
    foreach ($rows as $row) {
        $y = parseYearValue($row[$yearColumn] ?? null);
        if ($y === $year) {
            $filtered[] = $row;
        }
    }
    return $filtered;
}

function isYes($value): bool
{
    $v = strtolower(text($value, 40));
    return in_array($v, ['1', 'yes', 'y', 'true', 't', 'oo', 'meron', 'present', 'active'], true);
}

function normalizedSex($value): string
{
    $v = strtolower(text($value, 60));
    if ($v === 'f' || strpos($v, 'female') !== false) {
        return 'Female';
    }
    if ($v === 'm' || strpos($v, 'male') !== false) {
        return 'Male';
    }
    return '';
}

function normalizedEmployment($value): string
{
    $v = strtolower(text($value, 80));
    if (strpos($v, 'self') !== false) {
        return 'Self-Employed';
    }
    if (strpos($v, 'unemploy') !== false) {
        return 'Unemployed';
    }
    if (strpos($v, 'employ') !== false) {
        return 'Employed';
    }
    return '';
}

function normalizedEducation($value): string
{
    $v = strtolower(text($value, 120));
    if ($v === '' || $v === '-') {
        return '';
    }
    if ((strpos($v, 'no') !== false && strpos($v, 'school') !== false) || $v === 'none') {
        return 'No Schooling';
    }
    if (strpos($v, 'elementary') !== false || strpos($v, 'grade school') !== false) {
        return 'Elementary';
    }
    if (strpos($v, 'high school') !== false || strpos($v, 'secondary') !== false) {
        return 'High School';
    }
    if (strpos($v, 'college') !== false || strpos($v, 'university') !== false || strpos($v, 'tertiary') !== false) {
        return 'College';
    }
    if (strpos($v, 'vocational') !== false || strpos($v, 'tesda') !== false || strpos($v, 'technical') !== false) {
        return 'Vocational';
    }
    return '';
}

function parseAge($ageValue, $birthValue): ?int
{
    if ($ageValue !== null && $ageValue !== '') {
        $n = (int) preg_replace('/[^0-9]/', '', (string) $ageValue);
        if ($n >= 0 && $n <= 130) {
            return $n;
        }
    }
    $b = text($birthValue, 80);
    if ($b === '') {
        return null;
    }
    $ts = strtotime($b);
    if ($ts === false) {
        return null;
    }
    $birthYear = (int) date('Y', $ts);
    $age = (int) date('Y') - $birthYear;
    return ($age >= 0 && $age <= 130) ? $age : null;
}

function nfmt($value, int $decimals = 0): string
{
    return number_format((float) $value, $decimals);
}

function groupedCounts(array $rows, ?string $column): array
{
    $out = [];
    if (!$column) {
        return $out;
    }
    foreach ($rows as $row) {
        $label = text($row[$column] ?? '', 200);
        if ($label === '') {
            $label = 'Unspecified';
        }
        if (!isset($out[$label])) {
            $out[$label] = 0;
        }
        $out[$label]++;
    }
    arsort($out, SORT_NUMERIC);
    return $out;
}

function tableRowsFromCounts(array $counts): array
{
    $rows = [];
    foreach ($counts as $label => $total) {
        $rows[] = [text($label, 200), nfmt($total)];
    }
    if (!$rows) {
        $rows[] = ['No data available', '0'];
    }
    return $rows;
}

function annualHeaders(): array
{
    return [
        'Republic of the Philippines',
        'Region V (Bicol Region)',
        'Province of Albay',
        'City of Ligao',
        'Barangay Cabarian',
        'Office of the Punong Barangay',
    ];
}

function annualSignatories(): array
{
    return [
        'prepared' => ['label' => 'Prepared by:', 'name' => 'JUAN DELA CRUZ', 'title' => 'Barangay Secretary'],
        'approved' => ['label' => 'Approved by:', 'name' => 'HON. MARIA SANTOS', 'title' => 'Punong Barangay'],
    ];
}

function toInt($value, int $default = 0): int
{
    if (is_numeric($value)) {
        $num = (int) round((float) $value);
        return $num >= 0 ? $num : 0;
    }
    $txt = text($value, 80);
    if ($txt === '') {
        return $default;
    }
    $clean = preg_replace('/[^0-9.\-]/', '', $txt);
    if ($clean === null || $clean === '' || !is_numeric($clean)) {
        return $default;
    }
    $num = (int) round((float) $clean);
    return $num >= 0 ? $num : 0;
}

function toFloat($value, float $default = 0.0): float
{
    if (is_numeric($value)) {
        $num = (float) $value;
        return $num >= 0 ? $num : 0.0;
    }
    $txt = text($value, 80);
    if ($txt === '') {
        return $default;
    }
    $clean = preg_replace('/[^0-9.\-]/', '', $txt);
    if ($clean === null || $clean === '' || !is_numeric($clean)) {
        return $default;
    }
    $num = (float) $clean;
    return $num >= 0 ? $num : 0.0;
}

function payloadCount(array $source, array $keys, int $default = 0): int
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $source)) {
            return toInt($source[$key], $default);
        }
    }
    return $default;
}

function payloadFloat(array $source, array $keys, float $default = 0.0): float
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $source)) {
            return toFloat($source[$key], $default);
        }
    }
    return $default;
}

function mapCountsFromPayload($map): array
{
    $result = [];
    if (!is_array($map)) {
        return $result;
    }
    foreach ($map as $label => $value) {
        $name = text($label, 200);
        if ($name === '') {
            continue;
        }
        $result[$name] = toInt($value, 0);
    }
    arsort($result, SORT_NUMERIC);
    return $result;
}

function buildAnnualReportDataFromAnalytics(array $analytics, int $year): ?array
{
    $populationSummary = is_array($analytics['population_summary'] ?? null) ? $analytics['population_summary'] : [];
    $ageDistribution = is_array($analytics['age_group_distribution'] ?? null) ? $analytics['age_group_distribution'] : [];
    $socioEconomic = is_array($analytics['socio_economic'] ?? null) ? $analytics['socio_economic'] : [];
    $housingUtilities = is_array($analytics['housing_utilities'] ?? null) ? $analytics['housing_utilities'] : [];
    $healthRisk = is_array($analytics['health_risk'] ?? null) ? $analytics['health_risk'] : [];

    $hasAnalytics = !empty($populationSummary) || !empty($ageDistribution) || !empty($socioEconomic) || !empty($housingUtilities) || !empty($healthRisk);
    if (!$hasAnalytics) {
        return null;
    }

    $employment = is_array($socioEconomic['employment_status'] ?? null) ? $socioEconomic['employment_status'] : [];
    $education = is_array($socioEconomic['educational_attainment'] ?? null) ? $socioEconomic['educational_attainment'] : [];
    $otherIndicators = is_array($socioEconomic['other_indicators'] ?? null) ? $socioEconomic['other_indicators'] : [];

    $toilet = mapCountsFromPayload($housingUtilities['toilet_type'] ?? null);
    $water = mapCountsFromPayload($housingUtilities['water_source'] ?? null);
    $electricity = mapCountsFromPayload($housingUtilities['electricity_source'] ?? null);
    $ownership = mapCountsFromPayload($housingUtilities['housing_ownership'] ?? null);

    $deathsByCause = mapCountsFromPayload($healthRisk['deaths_by_cause'] ?? null);

    $population = payloadCount($populationSummary, ['total_population', 'total', 'population'], 0);
    $male = payloadCount($populationSummary, ['male'], 0);
    $female = payloadCount($populationSummary, ['female'], 0);
    $households = payloadCount($populationSummary, ['households', 'total_households'], 0);
    $avgHousehold = payloadFloat($populationSummary, ['average_household_size', 'avg_household_size'], 0.0);

    return [
        'year' => $year,
        'title' => 'BARANGAY ANNUAL HOUSEHOLD REPORT',
        'header_lines' => annualHeaders(),
        'generated_by' => 'Barangay Household Information Management System',
        'generated_date' => date('F d, Y'),
        'sections' => [
            [
                'title' => 'SECTION A. Population Summary',
                'tables' => [[
                    'title' => null,
                    'columns' => ['Indicator', 'Total'],
                    'rows' => [
                        ['Total Population', nfmt($population)],
                        ['Male', nfmt($male)],
                        ['Female', nfmt($female)],
                        ['Households', nfmt($households)],
                        ['Average Household Size', nfmt($avgHousehold, 2)],
                    ],
                ]],
            ],
            [
                'title' => 'SECTION B. Age Group Distribution',
                'tables' => [[
                    'title' => null,
                    'columns' => ['Age Group', 'Total'],
                    'rows' => [
                        ['0-5', nfmt(payloadCount($ageDistribution, ['0-5', 'age_0_5'], 0))],
                        ['6-12', nfmt(payloadCount($ageDistribution, ['6-12', 'age_6_12'], 0))],
                        ['13-17', nfmt(payloadCount($ageDistribution, ['13-17', 'age_13_17'], 0))],
                        ['18-59', nfmt(payloadCount($ageDistribution, ['18-59', 'age_18_59'], 0))],
                        ['60+', nfmt(payloadCount($ageDistribution, ['60+', 'age_60_plus'], 0))],
                    ],
                ]],
            ],
            [
                'title' => 'SECTION C. Socio-Economic Indicators',
                'tables' => [
                    ['title' => 'Employment Status Table', 'columns' => ['Status', 'Total'], 'rows' => [
                        ['Employed', nfmt(payloadCount($employment, ['Employed', 'employed'], 0))],
                        ['Unemployed', nfmt(payloadCount($employment, ['Unemployed', 'unemployed'], 0))],
                        ['Self-Employed', nfmt(payloadCount($employment, ['Self-Employed', 'self_employed', 'self-employed'], 0))],
                    ]],
                    ['title' => 'Educational Attainment Table', 'columns' => ['Level', 'Total'], 'rows' => [
                        ['No Schooling', nfmt(payloadCount($education, ['No Schooling', 'no_schooling'], 0))],
                        ['Elementary', nfmt(payloadCount($education, ['Elementary', 'elementary'], 0))],
                        ['High School', nfmt(payloadCount($education, ['High School', 'high_school'], 0))],
                        ['College', nfmt(payloadCount($education, ['College', 'college'], 0))],
                        ['Vocational', nfmt(payloadCount($education, ['Vocational', 'vocational'], 0))],
                    ]],
                    ['title' => 'Other Indicators Table', 'columns' => ['Indicator', 'Total'], 'rows' => [
                        ['PWD', nfmt(payloadCount($otherIndicators, ['PWD', 'pwd'], 0))],
                        ['Senior Citizens', nfmt(payloadCount($otherIndicators, ['Senior Citizens', 'senior_citizens'], 0))],
                        ['Solo Parents', nfmt(payloadCount($otherIndicators, ['Solo Parents', 'solo_parents'], 0))],
                    ]],
                ],
            ],
            [
                'title' => 'SECTION D. Housing & Utilities',
                'tables' => [
                    ['title' => 'Toilet Type', 'columns' => ['Toilet Type', 'Total'], 'rows' => tableRowsFromCounts($toilet)],
                    ['title' => 'Water Source', 'columns' => ['Water Source', 'Total'], 'rows' => tableRowsFromCounts($water)],
                    ['title' => 'Electricity Source', 'columns' => ['Electricity Source', 'Total'], 'rows' => tableRowsFromCounts($electricity)],
                    ['title' => 'Housing Ownership', 'columns' => ['Housing Ownership', 'Total'], 'rows' => tableRowsFromCounts($ownership)],
                ],
            ],
            [
                'title' => 'SECTION E. Health & Risk Indicators',
                'tables' => [
                    ['title' => 'Pregnant Women', 'columns' => ['Indicator', 'Total'], 'rows' => [['Pregnant Women', nfmt(payloadCount($healthRisk, ['pregnant_women', 'pregnantWomen'], 0))]]],
                    ['title' => 'Malnourished Children', 'columns' => ['Indicator', 'Total'], 'rows' => [['Malnourished Children', nfmt(payloadCount($healthRisk, ['malnourished_children', 'malnourishedChildren'], 0))]]],
                    ['title' => 'Persons with Illness', 'columns' => ['Indicator', 'Total'], 'rows' => [['Persons with Illness', nfmt(payloadCount($healthRisk, ['persons_with_illness', 'personsWithIllness'], 0))]]],
                    ['title' => 'Deaths by Cause', 'columns' => ['Cause', 'Total'], 'rows' => $deathsByCause ? tableRowsFromCounts($deathsByCause) : [['No recorded deaths', '0']],
                ]],
            ],
        ],
        'signatories' => annualSignatories(),
    ];
}

function buildAnnualReportData(int $year): array
{
    $population = 0;
    $male = 0;
    $female = 0;
    $households = 0;
    $avgHousehold = 0.0;

    $ages = ['0-5' => 0, '6-12' => 0, '13-17' => 0, '18-59' => 0, '60+' => 0];
    $employment = ['Employed' => 0, 'Unemployed' => 0, 'Self-Employed' => 0];
    $education = ['No Schooling' => 0, 'Elementary' => 0, 'High School' => 0, 'College' => 0, 'Vocational' => 0];
    $other = ['PWD' => 0, 'Senior Citizens' => 0, 'Solo Parents' => 0];

    $toiletCounts = [];
    $waterCounts = [];
    $electricityCounts = [];
    $ownershipCounts = [];

    $pregnantWomen = 0;
    $malnourishedChildren = 0;
    $personsWithIllness = 0;
    $deathsByCause = [];

    $residentRows = [];
    $householdRows = [];
    $deathRows = [];
    $residentMap = [];
    $householdMap = [];
    $deathMap = [];

    $pdo = dbConnection();
    if ($pdo instanceof PDO) {
        $residentTable = firstExistingTable($pdo, ['residents', 'resident_records', 'household_members', 'members', 'registrations']);
        if ($residentTable) {
            $cols = tableColumns($pdo, $residentTable);
            $residentMap = [
                'sex' => pickColumn($cols, ['sex', 'gender']),
                'age' => pickColumn($cols, ['age']),
                'birth' => pickColumn($cols, ['birthday', 'birthdate', 'date_of_birth', 'dob']),
                'employment' => pickColumn($cols, ['employment_status', 'employment', 'work_status']),
                'education' => pickColumn($cols, ['education', 'educational_attainment', 'education_level']),
                'pwd' => pickColumn($cols, ['pwd', 'is_pwd', 'has_pwd']),
                'senior' => pickColumn($cols, ['senior', 'is_senior', 'senior_citizen', 'is_senior_citizen']),
                'solo' => pickColumn($cols, ['solo_parent', 'is_solo_parent', 'solo']),
                'pregnant' => pickColumn($cols, ['health_maternal_pregnant', 'pregnant', 'is_pregnant']),
                'malnutrition' => pickColumn($cols, ['health_child_malnutrition', 'child_malnutrition', 'malnutrition']),
                'illness' => pickColumn($cols, ['health_current_illness', 'current_illness', 'has_illness']),
                'death_cause' => pickColumn($cols, ['death_cause', 'cause_of_death']),
                'deceased' => pickColumn($cols, ['deceased', 'is_deceased', 'status', 'alive_status']),
                'household_id' => pickColumn($cols, ['household_id', 'hh_id', 'household']),
                'toilet' => pickColumn($cols, ['toilet', 'toilet_type']),
                'water' => pickColumn($cols, ['water', 'water_source']),
                'electricity' => pickColumn($cols, ['electricity', 'electricity_source']),
                'ownership' => pickColumn($cols, ['ownership', 'house_ownership', 'housing_ownership']),
                'date' => pickColumn($cols, ['created_at', 'registered_at', 'registration_date', 'date_registered', 'updated_at', 'recorded_at']),
            ];
            $residentRows = fetchRowsByYear($pdo, $residentTable, array_values(array_filter($residentMap)), $residentMap['date'], $year);
        }

        $householdTable = firstExistingTable($pdo, ['households', 'household_records', 'household', 'registrations']);
        if ($householdTable) {
            $cols = tableColumns($pdo, $householdTable);
            $householdMap = [
                'household_id' => pickColumn($cols, ['household_id', 'hh_id', 'id']),
                'ownership' => pickColumn($cols, ['ownership', 'house_ownership', 'housing_ownership']),
                'toilet' => pickColumn($cols, ['toilet', 'toilet_type']),
                'water' => pickColumn($cols, ['water', 'water_source']),
                'electricity' => pickColumn($cols, ['electricity', 'electricity_source']),
                'pregnant' => pickColumn($cols, ['health_maternal_pregnant', 'pregnant', 'is_pregnant']),
                'malnutrition' => pickColumn($cols, ['health_child_malnutrition', 'child_malnutrition', 'malnutrition']),
                'illness' => pickColumn($cols, ['health_current_illness', 'current_illness', 'has_illness']),
                'date' => pickColumn($cols, ['created_at', 'registered_at', 'registration_date', 'date_registered', 'updated_at', 'recorded_at']),
            ];
            $householdRows = fetchRowsByYear($pdo, $householdTable, array_values(array_filter($householdMap)), $householdMap['date'], $year);
        }

        $deathTable = firstExistingTable($pdo, ['deaths', 'death_records', 'mortality_records', 'mortality']);
        if ($deathTable) {
            $cols = tableColumns($pdo, $deathTable);
            $deathMap = [
                'cause' => pickColumn($cols, ['cause_of_death', 'death_cause', 'cause']),
                'date' => pickColumn($cols, ['created_at', 'date_of_death', 'recorded_at', 'registered_at', 'updated_at']),
            ];
            $deathRows = fetchRowsByYear($pdo, $deathTable, array_values(array_filter($deathMap)), $deathMap['date'], $year);
        }
    }

    $population = count($residentRows);
    $residentHouseholds = [];
    foreach ($residentRows as $row) {
        $sex = normalizedSex($residentMap['sex'] ? ($row[$residentMap['sex']] ?? '') : '');
        if ($sex === 'Male') {
            $male++;
        } elseif ($sex === 'Female') {
            $female++;
        }

        $age = parseAge($residentMap['age'] ? ($row[$residentMap['age']] ?? null) : null, $residentMap['birth'] ? ($row[$residentMap['birth']] ?? null) : null);
        if ($age !== null) {
            if ($age <= 5) {
                $ages['0-5']++;
            } elseif ($age <= 12) {
                $ages['6-12']++;
            } elseif ($age <= 17) {
                $ages['13-17']++;
            } elseif ($age <= 59) {
                $ages['18-59']++;
            } else {
                $ages['60+']++;
            }
        }

        $e = normalizedEmployment($residentMap['employment'] ? ($row[$residentMap['employment']] ?? '') : '');
        if ($e !== '') {
            $employment[$e]++;
        }
        $edu = normalizedEducation($residentMap['education'] ? ($row[$residentMap['education']] ?? '') : '');
        if ($edu !== '') {
            $education[$edu]++;
        }

        if ($residentMap['pwd'] && isYes($row[$residentMap['pwd']] ?? '')) {
            $other['PWD']++;
        }
        if ($residentMap['senior'] && isYes($row[$residentMap['senior']] ?? '')) {
            $other['Senior Citizens']++;
        }
        if ($residentMap['solo'] && isYes($row[$residentMap['solo']] ?? '')) {
            $other['Solo Parents']++;
        }

        if ($residentMap['pregnant'] && isYes($row[$residentMap['pregnant']] ?? '')) {
            if ($sex === 'Female' || !$residentMap['sex']) {
                $pregnantWomen++;
            }
        }
        if ($residentMap['malnutrition'] && isYes($row[$residentMap['malnutrition']] ?? '')) {
            $malnourishedChildren++;
        }
        if ($residentMap['illness'] && isYes($row[$residentMap['illness']] ?? '')) {
            $personsWithIllness++;
        }

        if ($residentMap['household_id']) {
            $hh = text($row[$residentMap['household_id']] ?? '', 120);
            if ($hh !== '') {
                $residentHouseholds[$hh] = true;
            }
        }
    }

    if ($householdRows) {
        if ($householdMap['household_id']) {
            $hhSet = [];
            foreach ($householdRows as $row) {
                $hh = text($row[$householdMap['household_id']] ?? '', 120);
                if ($hh !== '') {
                    $hhSet[$hh] = true;
                }
            }
            $households = $hhSet ? count($hhSet) : count($householdRows);
        } else {
            $households = count($householdRows);
        }
    } else {
        $households = count($residentHouseholds);
    }
    $avgHousehold = $households > 0 ? $population / $households : 0.0;

    $toiletCounts = groupedCounts($householdRows, $householdMap['toilet'] ?? null);
    $waterCounts = groupedCounts($householdRows, $householdMap['water'] ?? null);
    $electricityCounts = groupedCounts($householdRows, $householdMap['electricity'] ?? null);
    $ownershipCounts = groupedCounts($householdRows, $householdMap['ownership'] ?? null);

    if (!$toiletCounts) {
        $toiletCounts = groupedCounts($residentRows, $residentMap['toilet'] ?? null);
    }
    if (!$waterCounts) {
        $waterCounts = groupedCounts($residentRows, $residentMap['water'] ?? null);
    }
    if (!$electricityCounts) {
        $electricityCounts = groupedCounts($residentRows, $residentMap['electricity'] ?? null);
    }
    if (!$ownershipCounts) {
        $ownershipCounts = groupedCounts($residentRows, $residentMap['ownership'] ?? null);
    }

    if ($malnourishedChildren === 0 && !empty($householdMap['malnutrition'])) {
        foreach ($householdRows as $row) {
            if (isYes($row[$householdMap['malnutrition']] ?? '')) {
                $malnourishedChildren++;
            }
        }
    }
    if ($personsWithIllness === 0 && !empty($householdMap['illness'])) {
        foreach ($householdRows as $row) {
            if (isYes($row[$householdMap['illness']] ?? '')) {
                $personsWithIllness++;
            }
        }
    }
    if ($pregnantWomen === 0 && !empty($householdMap['pregnant'])) {
        foreach ($householdRows as $row) {
            if (isYes($row[$householdMap['pregnant']] ?? '')) {
                $pregnantWomen++;
            }
        }
    }

    if ($deathRows && !empty($deathMap['cause'])) {
        foreach ($deathRows as $row) {
            $cause = text($row[$deathMap['cause']] ?? '', 200);
            if ($cause === '') {
                $cause = 'Unspecified';
            }
            if (!isset($deathsByCause[$cause])) {
                $deathsByCause[$cause] = 0;
            }
            $deathsByCause[$cause]++;
        }
    } elseif (!empty($residentMap['death_cause'])) {
        foreach ($residentRows as $row) {
            $cause = text($row[$residentMap['death_cause']] ?? '', 200);
            if ($cause === '') {
                continue;
            }
            $isDeceased = true;
            if (!empty($residentMap['deceased'])) {
                $status = strtolower(text($row[$residentMap['deceased']] ?? '', 60));
                if ($status !== '' && strpos($status, 'deceas') === false && strpos($status, 'dead') === false && !isYes($status)) {
                    $isDeceased = false;
                }
            }
            if (!$isDeceased) {
                continue;
            }
            if (!isset($deathsByCause[$cause])) {
                $deathsByCause[$cause] = 0;
            }
            $deathsByCause[$cause]++;
        }
    }

    if ($female === 0 && $population > 0 && $male > 0) {
        $female = max(0, $population - $male);
    }

    return [
        'year' => $year,
        'title' => 'BARANGAY ANNUAL HOUSEHOLD REPORT',
        'header_lines' => annualHeaders(),
        'generated_by' => 'Barangay Household Information Management System',
        'generated_date' => date('F d, Y'),
        'sections' => [
            [
                'title' => 'SECTION A. Population Summary',
                'tables' => [[
                    'title' => null,
                    'columns' => ['Indicator', 'Total'],
                    'rows' => [
                        ['Total Population', nfmt($population)],
                        ['Male', nfmt($male)],
                        ['Female', nfmt($female)],
                        ['Households', nfmt($households)],
                        ['Average Household Size', nfmt($avgHousehold, 2)],
                    ],
                ]],
            ],
            [
                'title' => 'SECTION B. Age Group Distribution',
                'tables' => [[
                    'title' => null,
                    'columns' => ['Age Group', 'Total'],
                    'rows' => [
                        ['0-5', nfmt($ages['0-5'])],
                        ['6-12', nfmt($ages['6-12'])],
                        ['13-17', nfmt($ages['13-17'])],
                        ['18-59', nfmt($ages['18-59'])],
                        ['60+', nfmt($ages['60+'])],
                    ],
                ]],
            ],
            [
                'title' => 'SECTION C. Socio-Economic Indicators',
                'tables' => [
                    ['title' => 'Employment Status Table', 'columns' => ['Status', 'Total'], 'rows' => [
                        ['Employed', nfmt($employment['Employed'])],
                        ['Unemployed', nfmt($employment['Unemployed'])],
                        ['Self-Employed', nfmt($employment['Self-Employed'])],
                    ]],
                    ['title' => 'Educational Attainment Table', 'columns' => ['Level', 'Total'], 'rows' => [
                        ['No Schooling', nfmt($education['No Schooling'])],
                        ['Elementary', nfmt($education['Elementary'])],
                        ['High School', nfmt($education['High School'])],
                        ['College', nfmt($education['College'])],
                        ['Vocational', nfmt($education['Vocational'])],
                    ]],
                    ['title' => 'Other Indicators Table', 'columns' => ['Indicator', 'Total'], 'rows' => [
                        ['PWD', nfmt($other['PWD'])],
                        ['Senior Citizens', nfmt($other['Senior Citizens'])],
                        ['Solo Parents', nfmt($other['Solo Parents'])],
                    ]],
                ],
            ],
            [
                'title' => 'SECTION D. Housing & Utilities',
                'tables' => [
                    ['title' => 'Toilet Type', 'columns' => ['Toilet Type', 'Total'], 'rows' => tableRowsFromCounts($toiletCounts)],
                    ['title' => 'Water Source', 'columns' => ['Water Source', 'Total'], 'rows' => tableRowsFromCounts($waterCounts)],
                    ['title' => 'Electricity Source', 'columns' => ['Electricity Source', 'Total'], 'rows' => tableRowsFromCounts($electricityCounts)],
                    ['title' => 'Housing Ownership', 'columns' => ['Housing Ownership', 'Total'], 'rows' => tableRowsFromCounts($ownershipCounts)],
                ],
            ],
            [
                'title' => 'SECTION E. Health & Risk Indicators',
                'tables' => [
                    ['title' => 'Pregnant Women', 'columns' => ['Indicator', 'Total'], 'rows' => [['Pregnant Women', nfmt($pregnantWomen)]]],
                    ['title' => 'Malnourished Children', 'columns' => ['Indicator', 'Total'], 'rows' => [['Malnourished Children', nfmt($malnourishedChildren)]]],
                    ['title' => 'Persons with Illness', 'columns' => ['Indicator', 'Total'], 'rows' => [['Persons with Illness', nfmt($personsWithIllness)]]],
                    ['title' => 'Deaths by Cause', 'columns' => ['Cause', 'Total'], 'rows' => $deathsByCause ? tableRowsFromCounts($deathsByCause) : [['No recorded deaths', '0']]],
                ],
            ],
        ],
        'signatories' => annualSignatories(),
    ];
}

function pdfLineCount(FPDF $pdf, float $width, string $text): int
{
    $max = max(1.0, $width);
    $content = str_replace("\r", '', $text);
    if ($content === '') {
        return 1;
    }
    $lines = 0;
    foreach (explode("\n", $content) as $paragraph) {
        $words = preg_split('/\s+/', trim($paragraph));
        if (!is_array($words) || !$words || $words[0] === '') {
            $lines++;
            continue;
        }
        $line = '';
        $count = 1;
        foreach ($words as $word) {
            $candidate = $line === '' ? $word : ($line . ' ' . $word);
            if ($pdf->GetStringWidth(toPdfText($candidate)) <= $max) {
                $line = $candidate;
                continue;
            }
            $count++;
            $line = $word;
        }
        $lines += $count;
    }
    return max(1, $lines);
}

function ensurePdfSpace(FPDF $pdf, float $height): void
{
    if ($pdf->GetY() + $height > $pdf->GetPageHeight() - 15) {
        $pdf->AddPage();
    }
}

function drawFpdfRow(FPDF $pdf, float $w1, float $w2, string $left, string $right, bool $header = false): void
{
    $lineHeight = 5.5;
    $rowHeight = max($lineHeight * max(pdfLineCount($pdf, $w1 - 3, $left), pdfLineCount($pdf, $w2 - 3, $right)), 8);
    ensurePdfSpace($pdf, $rowHeight + 1);
    $x = $pdf->GetX();
    $y = $pdf->GetY();
    if ($header) {
        $pdf->SetFillColor(238, 243, 248);
        $pdf->Rect($x, $y, $w1, $rowHeight, 'F');
        $pdf->Rect($x + $w1, $y, $w2, $rowHeight, 'F');
    }
    $pdf->Rect($x, $y, $w1, $rowHeight);
    $pdf->Rect($x + $w1, $y, $w2, $rowHeight);
    $pdf->SetXY($x + 1.5, $y + 1.3);
    $pdf->MultiCell($w1 - 3, $lineHeight, toPdfText($left), 0, 'L');
    $pdf->SetXY($x + $w1 + 1.5, $y + 1.3);
    $pdf->MultiCell($w2 - 3, $lineHeight, toPdfText($right), 0, 'C');
    $pdf->SetXY($x, $y + $rowHeight);
}

function renderReportWithFpdf(array $report): string
{
    if (!class_exists('FPDF')) {
        $fpdfFile = __DIR__ . '/vendor/setasign/fpdf/fpdf.php';
        if (is_file($fpdfFile)) {
            require_once $fpdfFile;
        }
    }
    if (!class_exists('FPDF')) {
        respondWithError(500, 'No PDF engine available. Install Dompdf or FPDF.');
    }

    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetMargins(14, 12, 14);
    $pdf->SetAutoPageBreak(true, 15);
    $pdf->AddPage();

    foreach ($report['header_lines'] as $line) {
        $pdf->SetFont('Arial', '', 10);
        $pdf->Cell(0, 5, toPdfText($line), 0, 1, 'C');
    }

    $pdf->Ln(2);
    $pdf->SetFont('Arial', 'B', 12);
    $pdf->Cell(0, 6, toPdfText($report['title']), 0, 1, 'C');
    $pdf->SetFont('Arial', 'B', 11);
    $pdf->Cell(0, 6, toPdfText('Calendar Year: ' . $report['year']), 0, 1, 'C');
    $pdf->SetFont('Arial', '', 10);
    $pdf->Cell(0, 5, toPdfText('Generated by: ' . $report['generated_by']), 0, 1, 'C');
    $pdf->Cell(0, 5, toPdfText('Date Generated: ' . $report['generated_date']), 0, 1, 'C');
    $pdf->Ln(3);

    $w1 = 118;
    $w2 = 62;
    foreach ($report['sections'] as $section) {
        ensurePdfSpace($pdf, 10);
        $pdf->SetFont('Arial', 'B', 10.5);
        $pdf->Cell(0, 7, toPdfText($section['title']), 0, 1, 'L');
        foreach ($section['tables'] as $table) {
            if (!empty($table['title'])) {
                ensurePdfSpace($pdf, 7);
                $pdf->SetFont('Arial', 'B', 10);
                $pdf->Cell(0, 6, toPdfText($table['title']), 0, 1, 'L');
            }
            $pdf->SetFont('Arial', 'B', 9.8);
            drawFpdfRow($pdf, $w1, $w2, (string) $table['columns'][0], (string) $table['columns'][1], true);
            $pdf->SetFont('Arial', '', 9.8);
            foreach ($table['rows'] as $row) {
                drawFpdfRow($pdf, $w1, $w2, text($row[0] ?? '-', 240), text($row[1] ?? '-', 240), false);
            }
            $pdf->Ln(2.2);
        }
    }

    $sig = $report['signatories'];
    ensurePdfSpace($pdf, 26);
    $pdf->Ln(5);
    $leftX = 20;
    $rightX = 115;
    $y = $pdf->GetY();
    $pdf->SetFont('Arial', '', 10);
    $pdf->SetXY($leftX, $y);
    $pdf->Cell(68, 6, toPdfText($sig['prepared']['label']), 0, 0, 'L');
    $pdf->SetXY($rightX, $y);
    $pdf->Cell(68, 6, toPdfText($sig['approved']['label']), 0, 1, 'L');
    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetX($leftX);
    $pdf->Cell(68, 13, toPdfText($sig['prepared']['name']), 0, 0, 'L');
    $pdf->SetX($rightX);
    $pdf->Cell(68, 13, toPdfText($sig['approved']['name']), 0, 1, 'L');
    $pdf->SetFont('Arial', '', 10);
    $pdf->SetX($leftX);
    $pdf->Cell(68, 6, toPdfText($sig['prepared']['title']), 0, 0, 'L');
    $pdf->SetX($rightX);
    $pdf->Cell(68, 6, toPdfText($sig['approved']['title']), 0, 1, 'L');

    $binary = $pdf->Output('S');
    if (!is_string($binary) || $binary === '') {
        respondWithError(500, 'Failed to generate PDF output.');
    }
    return $binary;
}

function buildPdfHtml(array $report): string
{
    $html = '<!doctype html><html><head><meta charset="utf-8"><style>';
    $html .= 'body{font-family:DejaVu Sans,sans-serif;font-size:11px;color:#1f2a3a;margin:34px;}';
    $html .= '.center{text-align:center;}.line{margin:0;line-height:1.45;}';
    $html .= '.title{font-size:15px;font-weight:700;margin:10px 0 4px;}';
    $html .= '.year{font-size:12.5px;font-weight:700;margin:0 0 10px;}';
    $html .= '.section{margin-top:14px;}.section-title{font-size:12.5px;font-weight:700;margin:0 0 6px;}';
    $html .= '.table-title{font-size:11px;font-weight:700;margin:7px 0 4px;}';
    $html .= 'table{width:100%;border-collapse:collapse;margin-bottom:8px;}';
    $html .= 'th,td{border:1px solid #2b3c52;padding:6px 7px;}';
    $html .= 'th{background:#eef3f8;font-weight:700;text-align:left;}';
    $html .= 'th:last-child,td:last-child{text-align:center;width:22%;}';
    $html .= '.sig-wrap{margin-top:22px;width:100%;}.sig{display:inline-block;width:48%;vertical-align:top;}';
    $html .= '.sig-right{float:right;text-align:left;}.sig-label{margin:0 0 20px;}.sig-name{margin:0;font-weight:700;}.sig-title{margin:2px 0 0;}';
    $html .= '</style></head><body>';
    foreach ($report['header_lines'] as $line) {
        $html .= '<p class="line center">' . esc($line) . '</p>';
    }
    $html .= '<p class="title center">' . esc($report['title']) . '</p>';
    $html .= '<p class="year center">Calendar Year: ' . esc((string) $report['year']) . '</p>';
    $html .= '<p class="line center">Generated by: ' . esc($report['generated_by']) . '</p>';
    $html .= '<p class="line center">Date Generated: ' . esc($report['generated_date']) . '</p>';
    foreach ($report['sections'] as $section) {
        $html .= '<div class="section"><p class="section-title">' . esc($section['title']) . '</p>';
        foreach ($section['tables'] as $table) {
            if (!empty($table['title'])) {
                $html .= '<p class="table-title">' . esc($table['title']) . '</p>';
            }
            $html .= '<table><thead><tr><th>' . esc($table['columns'][0]) . '</th><th>' . esc($table['columns'][1]) . '</th></tr></thead><tbody>';
            foreach ($table['rows'] as $row) {
                $html .= '<tr><td>' . esc(text($row[0] ?? '-', 240)) . '</td><td>' . esc(text($row[1] ?? '-', 240)) . '</td></tr>';
            }
            $html .= '</tbody></table>';
        }
        $html .= '</div>';
    }
    $sig = $report['signatories'];
    $html .= '<div class="sig-wrap"><div class="sig">';
    $html .= '<p class="sig-label">' . esc($sig['prepared']['label']) . '</p>';
    $html .= '<p class="sig-name">' . esc($sig['prepared']['name']) . '</p>';
    $html .= '<p class="sig-title">' . esc($sig['prepared']['title']) . '</p>';
    $html .= '</div><div class="sig sig-right">';
    $html .= '<p class="sig-label">' . esc($sig['approved']['label']) . '</p>';
    $html .= '<p class="sig-name">' . esc($sig['approved']['name']) . '</p>';
    $html .= '<p class="sig-title">' . esc($sig['approved']['title']) . '</p>';
    $html .= '</div></div></body></html>';
    return $html;
}

function outputPdf(array $report): void
{
    $binary = '';
    if (class_exists('Dompdf\\Dompdf')) {
        $opt = new Dompdf\Options();
        $opt->set('isRemoteEnabled', false);
        $opt->set('isHtml5ParserEnabled', true);
        $dompdf = new Dompdf\Dompdf($opt);
        $dompdf->loadHtml(buildPdfHtml($report), 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        $binary = $dompdf->output();
    } else {
        $binary = renderReportWithFpdf($report);
    }
    if (!is_string($binary) || $binary === '') {
        respondWithError(500, 'Failed to generate PDF output.');
    }
    $filename = 'Barangay_Cabarian_Annual_Report_' . $report['year'] . '.pdf';
    clearOutputBuffers();
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($binary));
    echo $binary;
    exit;
}

function renderSheetTable($sheet, int &$row, array $table, string $alignmentClass, string $borderClass): void
{
    if (!empty($table['title'])) {
        $sheet->setCellValue("A{$row}", $table['title']);
        $sheet->mergeCells("A{$row}:B{$row}");
        $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true)->setSize(10.5);
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        $row++;
    }

    $tableStart = $row;
    $sheet->setCellValue("A{$row}", $table['columns'][0]);
    $sheet->setCellValue("B{$row}", $table['columns'][1]);
    $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true);
    $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER)->setVertical($alignmentClass::VERTICAL_CENTER);
    $sheet->getStyle("A{$row}:B{$row}")->getFill()->setFillType(PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FFEFF3F8');
    $row++;

    foreach ($table['rows'] as $entry) {
        $sheet->setCellValue("A{$row}", text($entry[0] ?? '-', 240));
        $sheet->setCellValue("B{$row}", text($entry[1] ?? '-', 240));
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setVertical($alignmentClass::VERTICAL_CENTER)->setWrapText(true);
        $sheet->getStyle("B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
        $row++;
    }

    $tableEnd = $row - 1;
    $sheet->getStyle("A{$tableStart}:B{$tableEnd}")->getBorders()->getAllBorders()->setBorderStyle($borderClass::BORDER_THIN);
    $row++;
}

function outputSpreadsheet(array $report): void
{
    if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) {
        respondWithError(500, 'PhpSpreadsheet is not available. Run composer install first.');
    }

    $spreadsheet = new PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Annual Report');

    $alignmentClass = 'PhpOffice\\PhpSpreadsheet\\Style\\Alignment';
    $borderClass = 'PhpOffice\\PhpSpreadsheet\\Style\\Border';

    $row = 1;
    foreach ($report['header_lines'] as $line) {
        $sheet->setCellValue("A{$row}", $line);
        $sheet->mergeCells("A{$row}:B{$row}");
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
        $sheet->getStyle("A{$row}:B{$row}")->getFont()->setSize(10);
        $row++;
    }

    $row++;
    $sheet->setCellValue("A{$row}", $report['title']);
    $sheet->mergeCells("A{$row}:B{$row}");
    $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
    $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true)->setSize(13);
    $row++;
    $sheet->setCellValue("A{$row}", 'Calendar Year: ' . $report['year']);
    $sheet->mergeCells("A{$row}:B{$row}");
    $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
    $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true)->setSize(11);
    $row += 2;

    $sheet->setCellValue("A{$row}", 'Generated by: ' . $report['generated_by']);
    $sheet->mergeCells("A{$row}:B{$row}");
    $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
    $row++;
    $sheet->setCellValue("A{$row}", 'Date Generated: ' . $report['generated_date']);
    $sheet->mergeCells("A{$row}:B{$row}");
    $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
    $row += 2;

    foreach ($report['sections'] as $section) {
        $sheet->setCellValue("A{$row}", $section['title']);
        $sheet->mergeCells("A{$row}:B{$row}");
        $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        $row++;
        foreach ($section['tables'] as $table) {
            renderSheetTable($sheet, $row, $table, $alignmentClass, $borderClass);
        }
    }

    $sig = $report['signatories'];
    $row++;
    $sheet->setCellValue("A{$row}", $sig['prepared']['label']);
    $sheet->setCellValue("B{$row}", $sig['approved']['label']);
    $row++;
    $sheet->setCellValue("A{$row}", $sig['prepared']['name']);
    $sheet->setCellValue("B{$row}", $sig['approved']['name']);
    $sheet->getStyle("A{$row}:B{$row}")->getFont()->setBold(true);
    $row++;
    $sheet->setCellValue("A{$row}", $sig['prepared']['title']);
    $sheet->setCellValue("B{$row}", $sig['approved']['title']);

    $sheet->getColumnDimension('A')->setAutoSize(true);
    $sheet->getColumnDimension('B')->setAutoSize(true);

    $writer = new PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
    $filename = 'Barangay_Cabarian_Annual_Report_' . $report['year'] . '.xlsx';
    clearOutputBuffers();
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    $writer->save('php://output');
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    exit;
}

$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$origin = text($_SERVER['HTTP_ORIGIN'] ?? '', 300);
$allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
}
if ($requestMethod === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($requestMethod !== 'POST') {
    header('Allow: POST');
    respondWithError(405, 'Method not allowed. Use POST.');
}

$autoload = __DIR__ . '/vendor/autoload.php';
if (!is_file($autoload)) {
    respondWithError(500, 'Composer dependencies are missing. Run: composer install');
}
require_once $autoload;

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    respondWithError(400, 'Empty request body.');
}
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    respondWithError(400, 'Invalid JSON payload.');
}

$format = strtolower(text($payload['format'] ?? 'pdf', 10));
if ($format !== 'pdf' && $format !== 'xlsx') {
    respondWithError(400, 'Unsupported format. Use pdf or xlsx.');
}

$year = parseSelectedYear($payload['year'] ?? ($payload['report']['year'] ?? null));
$analyticsPayload = is_array($payload['analytics'] ?? null) ? $payload['analytics'] : null;
$report = null;
if ($analyticsPayload !== null) {
    $report = buildAnnualReportDataFromAnalytics($analyticsPayload, $year);
}
if (!is_array($report)) {
    $report = buildAnnualReportData($year);
}

if ($format === 'pdf') {
    outputPdf($report);
}
outputSpreadsheet($report);
