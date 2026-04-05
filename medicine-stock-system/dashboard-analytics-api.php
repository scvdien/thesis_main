<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function mss_dashboard_text(mixed $value): string
{
    return trim((string) ($value ?? ''));
}

function mss_dashboard_int(mixed $value, int $default = 0, ?int $min = 0): int
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    $number = $parsed !== false ? (int) $parsed : $default;

    return $min === null ? $number : max($min, $number);
}

function mss_dashboard_float(mixed $value, float $default = 0.0): float
{
    return is_numeric($value) ? (float) $value : $default;
}

function mss_dashboard_sum(array $values): float
{
    $total = 0.0;
    foreach ($values as $value) {
        $total += mss_dashboard_float($value);
    }

    return $total;
}

function mss_dashboard_average(array $values): float
{
    if ($values === []) {
        return 0.0;
    }

    return mss_dashboard_sum($values) / count($values);
}

function mss_dashboard_moving_average_forecast(array $series, int $windowSize = 3): float
{
    if ($series === []) {
        return 0.0;
    }

    return mss_dashboard_average(array_slice($series, -$windowSize));
}

function mss_dashboard_exponential_smoothing_forecast(array $series, float $alpha = 0.35): float
{
    if ($series === []) {
        return 0.0;
    }

    $level = mss_dashboard_float($series[0]);
    $count = count($series);
    for ($index = 1; $index < $count; $index += 1) {
        $level = ($alpha * mss_dashboard_float($series[$index])) + ((1 - $alpha) * $level);
    }

    return $level;
}

function mss_dashboard_key(mixed $value): string
{
    $normalized = preg_replace('/\s+/', ' ', strtolower(mss_dashboard_text($value)));
    return trim((string) $normalized);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_seasons(): array
{
    return [
        [
            'key' => 'dry',
            'label' => 'Dry Season',
            'months' => [11, 0, 1, 2, 3, 4],
            'iconClass' => 'bi bi-brightness-high-fill',
        ],
        [
            'key' => 'rainy',
            'label' => 'Rainy Season',
            'months' => [5, 6, 7, 8, 9, 10],
            'iconClass' => 'bi bi-cloud-rain-heavy-fill',
        ],
    ];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_resolve_season(int $monthIndex): array
{
    $seasons = mss_dashboard_seasons();
    foreach ($seasons as $season) {
        if (in_array($monthIndex, $season['months'], true)) {
            return $season;
        }
    }

    return $seasons[0];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_next_season(string $seasonKey): array
{
    $seasons = mss_dashboard_seasons();
    $count = count($seasons);
    for ($index = 0; $index < $count; $index += 1) {
        if (($seasons[$index]['key'] ?? '') === $seasonKey) {
            return $seasons[($index + 1) % $count];
        }
    }

    return $seasons[0];
}

function mss_dashboard_medicine_display_name(array $row): string
{
    $name = mss_dashboard_text($row['name'] ?? '');
    $strength = mss_dashboard_text($row['strength'] ?? '');

    return trim($name . ($strength !== '' ? ' ' . $strength : ''));
}

function mss_dashboard_medicine_detail_label(array $row): string
{
    $strength = mss_dashboard_text($row['strength'] ?? '');
    $form = mss_dashboard_text($row['form'] ?? '');
    $parts = array_values(array_filter([$strength, $form], static fn (string $value): bool => $value !== ''));

    return $parts !== [] ? implode(' ', $parts) : $form;
}

function mss_dashboard_medicine_icon(string $form): string
{
    $normalized = mss_dashboard_key($form);

    return match (true) {
        str_contains($normalized, 'syrup'),
        str_contains($normalized, 'liquid') => 'bi bi-capsule-pill',
        str_contains($normalized, 'injection'),
        str_contains($normalized, 'vial') => 'bi bi-prescription2',
        default => 'bi bi-capsule',
    };
}

function mss_dashboard_action_label(string $action): string
{
    return match ($action) {
        'Early Request' => 'Request Soon',
        'Build Buffer' => 'Prepare Extra Stock',
        default => 'Watch Demand',
    };
}

function mss_dashboard_action_tone(string $action): string
{
    return in_array($action, ['Early Request', 'Build Buffer'], true) ? 'warning' : 'success';
}

function mss_dashboard_now(): DateTimeImmutable
{
    return new DateTimeImmutable('now');
}

function mss_dashboard_to_iso_datetime(mixed $value): string
{
    $raw = mss_dashboard_text($value);
    if ($raw === '') {
        return '';
    }

    try {
        return (new DateTimeImmutable($raw))->format(DATE_ATOM);
    } catch (Throwable) {
        return '';
    }
}

function mss_dashboard_to_date_key(mixed $value): string
{
    $raw = mss_dashboard_text($value);
    if ($raw === '') {
        return '';
    }

    try {
        return (new DateTimeImmutable($raw))->format('Y-m-d');
    } catch (Throwable) {
        return '';
    }
}

function mss_dashboard_diff_days(string $startDate, string $endDate): int
{
    if ($startDate === '' || $endDate === '') {
        return 0;
    }

    try {
        $start = new DateTimeImmutable($startDate . ' 00:00:00');
        $end = new DateTimeImmutable($endDate . ' 00:00:00');
        $diff = $start->diff($end);

        return max(0, (int) $diff->format('%r%a'));
    } catch (Throwable) {
        return 0;
    }
}

function mss_dashboard_days_until(mixed $value, ?DateTimeImmutable $today = null): float
{
    $dateKey = mss_dashboard_to_date_key($value);
    if ($dateKey === '') {
        return INF;
    }

    try {
        $target = new DateTimeImmutable($dateKey . ' 00:00:00');
        $baseline = ($today ?? mss_dashboard_now())->setTime(0, 0);
        $diff = $baseline->diff($target);

        return (float) ((int) $diff->format('%r%a'));
    } catch (Throwable) {
        return INF;
    }
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_fetch_inventory_records(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT `id`, `name`, `form`, `strength`, `stock_on_hand`, `reorder_level`, `unit`, `expiry_date`, `record_status`
         FROM `mss_inventory_records`
         WHERE LOWER(`record_status`) = \'active\'
         ORDER BY `name` ASC, `strength` ASC, `form` ASC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return array_values(array_filter(array_map(static function (array $row): ?array {
        $name = mss_dashboard_text($row['name'] ?? '');
        if ($name === '') {
            return null;
        }

        $form = mss_dashboard_text($row['form'] ?? '') ?: 'Medicine';

        return [
            'id' => mss_dashboard_text($row['id'] ?? ''),
            'name' => $name,
            'displayName' => mss_dashboard_medicine_display_name($row),
            'shortName' => $name,
            'form' => $form,
            'strength' => mss_dashboard_text($row['strength'] ?? ''),
            'stockOnHand' => mss_dashboard_int($row['stock_on_hand'] ?? 0),
            'reorderLevel' => mss_dashboard_int($row['reorder_level'] ?? 1, 1),
            'unit' => mss_dashboard_text($row['unit'] ?? '') ?: 'units',
            'expiryDate' => mss_dashboard_text($row['expiry_date'] ?? ''),
            'icon' => mss_dashboard_medicine_icon($form),
        ];
    }, $rows)));
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_fetch_inventory_movements(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT `id`, `medicine_id`, `medicine_name`, `action_type`, `quantity`, `disease_category`, `illness`, `created_at`,
                `linked_request_id`, `linked_request_item_id`, `linked_request_group_id`, `linked_request_code`
         FROM `mss_inventory_movements`
         ORDER BY `created_at` DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return array_map(static function (array $row): array {
        return [
            'id' => mss_dashboard_text($row['id'] ?? ''),
            'medicineId' => mss_dashboard_text($row['medicine_id'] ?? ''),
            'medicineName' => mss_dashboard_text($row['medicine_name'] ?? ''),
            'actionType' => strtolower(mss_dashboard_text($row['action_type'] ?? '')),
            'quantity' => mss_dashboard_int($row['quantity'] ?? 0),
            'diseaseCategory' => mss_dashboard_text($row['disease_category'] ?? ''),
            'illness' => mss_dashboard_text($row['illness'] ?? ''),
            'createdAt' => mss_dashboard_to_iso_datetime($row['created_at'] ?? ''),
            'linkedRequestId' => mss_dashboard_text($row['linked_request_id'] ?? ''),
            'linkedRequestItemId' => mss_dashboard_text($row['linked_request_item_id'] ?? ''),
            'linkedRequestGroupId' => mss_dashboard_text($row['linked_request_group_id'] ?? ''),
            'linkedRequestCode' => mss_dashboard_text($row['linked_request_code'] ?? ''),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_fetch_requests(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT `id`, `request_group_id`, `request_code`, `medicine_id`, `medicine_name`, `generic_name`, `strength`, `unit`,
                `quantity_requested`, `request_date`, `expected_date`, `source`, `requested_by`, `notes`, `created_at`, `updated_at`
         FROM `mss_cho_requests`
         ORDER BY `request_date` DESC, `created_at` DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    return array_map(static function (array $row): array {
        return [
            'id' => mss_dashboard_text($row['id'] ?? ''),
            'requestGroupId' => mss_dashboard_text($row['request_group_id'] ?? ''),
            'requestCode' => mss_dashboard_text($row['request_code'] ?? ''),
            'medicineId' => mss_dashboard_text($row['medicine_id'] ?? ''),
            'medicineName' => mss_dashboard_text($row['medicine_name'] ?? ''),
            'genericName' => mss_dashboard_text($row['generic_name'] ?? ''),
            'strength' => mss_dashboard_text($row['strength'] ?? ''),
            'unit' => mss_dashboard_text($row['unit'] ?? '') ?: 'units',
            'quantityRequested' => max(1, mss_dashboard_int($row['quantity_requested'] ?? 1, 1)),
            'requestDate' => mss_dashboard_to_date_key($row['request_date'] ?? ''),
            'expectedDate' => mss_dashboard_to_date_key($row['expected_date'] ?? ''),
            'source' => mss_dashboard_text($row['source'] ?? '') ?: 'City Health Office (CHO)',
            'requestedBy' => mss_dashboard_text($row['requested_by'] ?? '') ?: 'Nurse-in-Charge',
            'notes' => mss_dashboard_text($row['notes'] ?? ''),
            'createdAt' => mss_dashboard_to_iso_datetime($row['created_at'] ?? ''),
            'updatedAt' => mss_dashboard_to_iso_datetime($row['updated_at'] ?? ''),
        ];
    }, $rows);
}

/**
 * @return array<string, array<string, int>>
 */
function mss_dashboard_build_usage_map(array $movements, int $windowDays = 30): array
{
    $cutoff = mss_dashboard_now()->modify('-' . $windowDays . ' days')->getTimestamp();
    $usageMap = [];

    foreach ($movements as $movement) {
        if (mss_dashboard_key($movement['actionType'] ?? '') !== 'dispense') {
            continue;
        }

        $createdAt = strtotime((string) ($movement['createdAt'] ?? ''));
        if ($createdAt === false || $createdAt < $cutoff) {
            continue;
        }

        $keys = array_values(array_filter([
            mss_dashboard_text($movement['medicineId'] ?? ''),
            mss_dashboard_key($movement['medicineName'] ?? ''),
        ]));

        foreach ($keys as $key) {
            if (!isset($usageMap[$key])) {
                $usageMap[$key] = ['quantity' => 0, 'count' => 0];
            }
            $usageMap[$key]['quantity'] += mss_dashboard_int($movement['quantity'] ?? 0);
            $usageMap[$key]['count'] += 1;
        }
    }

    return $usageMap;
}

/**
 * @return array<string, int>
 */
function mss_dashboard_usage_for_medicine(array $usageMap, array $medicine): array
{
    $idKey = mss_dashboard_text($medicine['id'] ?? '');
    if ($idKey !== '' && isset($usageMap[$idKey])) {
        return $usageMap[$idKey];
    }

    $nameKey = mss_dashboard_key($medicine['shortName'] ?? $medicine['name'] ?? '');
    if ($nameKey !== '' && isset($usageMap[$nameKey])) {
        return $usageMap[$nameKey];
    }

    return ['quantity' => 0, 'count' => 0];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_monitoring_snapshot(array $inventory, array $movements): array
{
    $now = mss_dashboard_now();
    $usageMap = mss_dashboard_build_usage_map($movements, 30);

    $inventoryRows = array_map(static function (array $medicine) use ($usageMap, $now): array {
        $usage = mss_dashboard_usage_for_medicine($usageMap, $medicine);
        $monthlyUsage = max(0, (int) round(mss_dashboard_float($usage['quantity'] ?? 0)));
        $daysLeft = mss_dashboard_days_until($medicine['expiryDate'] ?? '', $now);
        $monthsToExpire = is_finite($daysLeft) ? $daysLeft / 30 : INF;
        $monthsToClear = $monthlyUsage > 0 ? mss_dashboard_float($medicine['stockOnHand'] ?? 0) / $monthlyUsage : INF;
        $overstockThreshold = max(
            (int) round(mss_dashboard_float($medicine['reorderLevel'] ?? 1) * 3),
            $monthlyUsage > 0
                ? (int) round($monthlyUsage * 4)
                : (int) round(mss_dashboard_float($medicine['reorderLevel'] ?? 1) * 4)
        );
        $isLow = mss_dashboard_int($medicine['stockOnHand'] ?? 0) <= mss_dashboard_int($medicine['reorderLevel'] ?? 1, 1);
        $isOverstock = !$isLow && mss_dashboard_int($medicine['stockOnHand'] ?? 0) >= $overstockThreshold;

        $consumptionLevel = 'Moderate';
        $consumptionTone = 'moderate';
        if ($monthlyUsage >= 60) {
            $consumptionLevel = 'Fast';
            $consumptionTone = 'fast';
        } elseif ($monthlyUsage <= 15) {
            $consumptionLevel = 'Slow';
            $consumptionTone = 'slow';
        }

        $expiryTone = 'watch';
        if (is_finite($daysLeft) && ($daysLeft < 0 || $daysLeft <= 30)) {
            $expiryTone = 'danger';
        } elseif (is_finite($daysLeft) && $daysLeft <= 60) {
            $expiryTone = 'warning';
        }

        $severityScore = $monthsToClear - $monthsToExpire;
        $expiryStatus = 'Healthy';
        if ((is_finite($daysLeft) && $daysLeft < 0) || $severityScore >= 0.4) {
            $expiryStatus = 'High Risk';
        } elseif ((is_finite($daysLeft) && $daysLeft <= 90) || $severityScore >= -0.2) {
            $expiryStatus = 'Watch';
        }

        return [
            'id' => $medicine['id'],
            'name' => $medicine['displayName'] ?? $medicine['name'],
            'shortName' => $medicine['shortName'] ?? $medicine['name'],
            'icon' => $medicine['icon'] ?? 'bi bi-capsule',
            'stock' => max(0, mss_dashboard_int($medicine['stockOnHand'] ?? 0)),
            'reorderLevel' => max(1, mss_dashboard_int($medicine['reorderLevel'] ?? 1, 1)),
            'unit' => $medicine['unit'] ?? 'units',
            'expiryDate' => $medicine['expiryDate'] ?? '',
            'expiryLabel' => $medicine['expiryDate'] ? date('M d', strtotime((string) $medicine['expiryDate'])) : '-',
            'daysLeft' => is_finite($daysLeft) ? (int) round($daysLeft) : PHP_INT_MAX,
            'monthlyUsage' => $monthlyUsage,
            'usageCount' => mss_dashboard_int($usage['count'] ?? 0),
            'monthsToExpire' => is_finite($monthsToExpire) ? $monthsToExpire : null,
            'monthsToClear' => is_finite($monthsToClear) ? $monthsToClear : null,
            'severityScore' => is_finite($severityScore) ? $severityScore : 0,
            'consumptionLevel' => $consumptionLevel,
            'consumptionTone' => $consumptionTone,
            'expiryTone' => $expiryTone,
            'expiryStatus' => $expiryStatus,
            'isLow' => $isLow,
            'isOverstock' => $isOverstock,
            'overstockThreshold' => $overstockThreshold,
        ];
    }, $inventory);

    $activeMovementItems = array_values(array_filter($inventoryRows, static fn (array $item): bool => ($item['monthlyUsage'] ?? 0) > 0));
    usort($activeMovementItems, static function (array $left, array $right): int {
        $usageComparison = ((int) ($right['monthlyUsage'] ?? 0)) <=> ((int) ($left['monthlyUsage'] ?? 0));
        if ($usageComparison !== 0) {
            return $usageComparison;
        }

        $countComparison = ((int) ($right['usageCount'] ?? 0)) <=> ((int) ($left['usageCount'] ?? 0));
        if ($countComparison !== 0) {
            return $countComparison;
        }

        return ((int) ($left['stock'] ?? 0)) <=> ((int) ($right['stock'] ?? 0));
    });

    $fastMovement = array_map(static fn (array $item): array => array_merge($item, [
        'movementLabel' => 'Fast Moving',
        'movementHelper' => 'High stock turnover',
        'movementTone' => 'fast',
    ]), array_slice($activeMovementItems, 0, 4));

    $fastMovementIds = array_fill_keys(array_map(static fn (array $item): string => (string) ($item['id'] ?? ''), $fastMovement), true);
    $slowMovementBase = array_values(array_filter($inventoryRows, static fn (array $item): bool => !isset($fastMovementIds[(string) ($item['id'] ?? '')])));
    usort($slowMovementBase, static function (array $left, array $right): int {
        $leftHasUsage = ((int) ($left['monthlyUsage'] ?? 0)) > 0 ? 1 : 0;
        $rightHasUsage = ((int) ($right['monthlyUsage'] ?? 0)) > 0 ? 1 : 0;
        if ($leftHasUsage !== $rightHasUsage) {
            return $rightHasUsage <=> $leftHasUsage;
        }
        if (($left['monthlyUsage'] ?? 0) !== ($right['monthlyUsage'] ?? 0)) {
            return ((int) ($left['monthlyUsage'] ?? 0)) <=> ((int) ($right['monthlyUsage'] ?? 0));
        }
        if (($left['stock'] ?? 0) !== ($right['stock'] ?? 0)) {
            return ((int) ($left['stock'] ?? 0)) <=> ((int) ($right['stock'] ?? 0));
        }

        return strcmp((string) ($left['shortName'] ?? ''), (string) ($right['shortName'] ?? ''));
    });
    $slowMovement = array_map(static function (array $item): array {
        $hasUsage = ((int) ($item['monthlyUsage'] ?? 0)) > 0;

        return array_merge($item, [
            'movementLabel' => $hasUsage ? 'Slow Moving' : 'No Recent Dispense',
            'movementHelper' => $hasUsage ? 'Low stock turnover' : 'No recorded dispense in the last 30 days',
            'movementTone' => 'slow',
        ]);
    }, array_slice($slowMovementBase, 0, 4));

    $expiringMedicines = array_values(array_filter($inventoryRows, static fn (array $item): bool => ($item['daysLeft'] ?? PHP_INT_MAX) <= 90));
    usort($expiringMedicines, static fn (array $left, array $right): int => ((int) ($left['daysLeft'] ?? PHP_INT_MAX)) <=> ((int) ($right['daysLeft'] ?? PHP_INT_MAX)));
    $expiringMedicines = array_slice($expiringMedicines, 0, 5);
    $withinThirtyDays = count(array_filter($expiringMedicines, static fn (array $item): bool => ($item['daysLeft'] ?? PHP_INT_MAX) <= 30));

    $slowConsumptionItems = $inventoryRows;
    usort($slowConsumptionItems, static function (array $left, array $right): int {
        $usageComparison = ((int) ($left['monthlyUsage'] ?? 0)) <=> ((int) ($right['monthlyUsage'] ?? 0));
        if ($usageComparison !== 0) {
            return $usageComparison;
        }

        return ((int) ($left['daysLeft'] ?? PHP_INT_MAX)) <=> ((int) ($right['daysLeft'] ?? PHP_INT_MAX));
    });
    $slowConsumptionItems = array_slice($slowConsumptionItems, 0, 4);

    $riskItems = array_values(array_filter($inventoryRows, static fn (array $item): bool => ($item['daysLeft'] ?? PHP_INT_MAX) <= 90 || ($item['expiryStatus'] ?? 'Healthy') !== 'Healthy'));
    usort($riskItems, static function (array $left, array $right): int {
        $severityComparison = mss_dashboard_float($right['severityScore'] ?? 0) <=> mss_dashboard_float($left['severityScore'] ?? 0);
        if ($severityComparison !== 0) {
            return $severityComparison;
        }

        return ((int) ($left['daysLeft'] ?? PHP_INT_MAX)) <=> ((int) ($right['daysLeft'] ?? PHP_INT_MAX));
    });
    $riskItem = $riskItems[0] ?? null;

    $lowItems = array_values(array_filter($inventoryRows, static fn (array $item): bool => (bool) ($item['isLow'] ?? false)));
    $overstockItems = array_values(array_filter($inventoryRows, static fn (array $item): bool => (bool) ($item['isOverstock'] ?? false)));
    $balancedItems = array_values(array_filter($inventoryRows, static fn (array $item): bool => !($item['isLow'] ?? false) && !($item['isOverstock'] ?? false)));
    $focusItem = $lowItems[0] ?? $balancedItems[0] ?? $overstockItems[0] ?? $inventoryRows[0] ?? null;
    $comparisonItems = array_values(array_filter([
        $lowItems[0] ?? null,
        $balancedItems[0] ?? null,
        $overstockItems[0] ?? null,
    ]));

    return [
        'generatedAt' => $now->format(DATE_ATOM),
        'movement' => [
            'fast' => $fastMovement,
            'slow' => $slowMovement,
        ],
        'expiry' => [
            'soonCount' => count($expiringMedicines),
            'withinThirtyCount' => $withinThirtyDays,
            'inventoryTotalUnits' => (int) array_reduce($inventoryRows, static fn (int $total, array $item): int => $total + (int) ($item['stock'] ?? 0), 0),
            'slowConsumptionCount' => count(array_filter($slowConsumptionItems, static fn (array $item): bool => ($item['consumptionLevel'] ?? '') === 'Slow')),
            'medicines' => $expiringMedicines,
            'slowConsumption' => $slowConsumptionItems,
            'riskItem' => $riskItem,
        ],
        'balance' => [
            'totalMedicines' => count($inventoryRows),
            'balancedCount' => count($balancedItems),
            'lowCount' => count($lowItems),
            'overstockCount' => count($overstockItems),
            'rows' => $inventoryRows,
            'focusItem' => $focusItem,
            'comparisonItems' => $comparisonItems,
        ],
    ];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_resolve_disease_label(array $movement): string
{
    $category = mss_dashboard_text($movement['diseaseCategory'] ?? '');
    $illness = mss_dashboard_text($movement['illness'] ?? '');

    if ($category !== '' && mss_dashboard_key($category) !== 'others') {
        return $category;
    }

    if ($illness !== '') {
        return $illness;
    }

    return $category !== '' ? $category : 'Unspecified';
}

function mss_dashboard_medicine_signal_key(array $movement): string
{
    $medicineId = mss_dashboard_text($movement['medicineId'] ?? '');
    if ($medicineId !== '') {
        return 'id:' . $medicineId;
    }

    $medicineName = mss_dashboard_key($movement['medicineName'] ?? '');
    return $medicineName !== '' ? 'name:' . $medicineName : '';
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_prepare_dispense_disease_rows(array $movements): array
{
    $rows = [];

    foreach ($movements as $movement) {
        if (mss_dashboard_key($movement['actionType'] ?? '') !== 'dispense') {
            continue;
        }

        $medicineKey = mss_dashboard_medicine_signal_key($movement);
        if ($medicineKey === '') {
            continue;
        }

        $createdAt = mss_dashboard_text($movement['createdAt'] ?? '');
        $createdTimestamp = $createdAt !== '' ? strtotime($createdAt) : false;

        $rows[] = [
            'medicineKey' => $medicineKey,
            'medicineName' => mss_dashboard_text($movement['medicineName'] ?? '') ?: 'Unknown medicine',
            'quantity' => max(0, mss_dashboard_int($movement['quantity'] ?? 0)),
            'label' => mss_dashboard_resolve_disease_label($movement),
            'createdAt' => $createdAt,
            'createdTimestamp' => $createdTimestamp !== false ? (int) $createdTimestamp : 0,
        ];
    }

    return $rows;
}

/**
 * @param array<int, array<string, mixed>> $rows
 */
function mss_dashboard_sort_disease_rows(array &$rows): void
{
    usort($rows, static function (array $left, array $right): int {
        $requestComparison = ((int) ($right['requests'] ?? 0)) <=> ((int) ($left['requests'] ?? 0));
        if ($requestComparison !== 0) {
            return $requestComparison;
        }

        $quantityComparison = ((int) ($right['quantity'] ?? 0)) <=> ((int) ($left['quantity'] ?? 0));
        if ($quantityComparison !== 0) {
            return $quantityComparison;
        }

        return strcmp((string) ($left['illness'] ?? $left['medicine'] ?? ''), (string) ($right['illness'] ?? $right['medicine'] ?? ''));
    });
}

/**
 * @param array<int, array<string, mixed>> $items
 */
function mss_dashboard_summarize_supporting_medicines(array $items): string
{
    $labels = array_values(array_filter(array_map(
        static fn (array $item): string => mss_dashboard_text($item['medicine'] ?? ''),
        $items
    )));

    if ($labels === []) {
        return 'No strong medicine signal yet';
    }
    if (count($labels) <= 2) {
        return implode(', ', $labels);
    }

    return implode(', ', array_slice($labels, 0, 2)) . ' +' . (count($labels) - 2) . ' more';
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_recorded_disease_pattern_rows(array $dispenseRows): array
{
    $diseaseSignalMap = [];
    $medicineSignalMap = [];

    foreach ($dispenseRows as $row) {
        $patternLabel = mss_dashboard_text($row['label'] ?? '') ?: 'Unspecified';
        $medicineName = mss_dashboard_text($row['medicineName'] ?? '') ?: 'Unknown medicine';
        $quantity = max(0, mss_dashboard_int($row['quantity'] ?? 0));
        $createdAt = mss_dashboard_text($row['createdAt'] ?? '');

        if (!isset($diseaseSignalMap[$patternLabel])) {
            $diseaseSignalMap[$patternLabel] = [
                'illness' => $patternLabel,
                'requests' => 0,
                'quantity' => 0,
                'latestAt' => '',
                'basis' => 'recorded',
                'basisLabel' => 'Recorded dispense cases',
            ];
        }
        $diseaseSignalMap[$patternLabel]['requests'] += 1;
        $diseaseSignalMap[$patternLabel]['quantity'] += $quantity;
        if (
            $createdAt !== ''
            && strtotime($createdAt) !== false
            && (
                $diseaseSignalMap[$patternLabel]['latestAt'] === ''
                || strtotime($createdAt) > strtotime((string) $diseaseSignalMap[$patternLabel]['latestAt'])
            )
        ) {
            $diseaseSignalMap[$patternLabel]['latestAt'] = $createdAt;
        }

        if (!isset($medicineSignalMap[$medicineName])) {
            $medicineSignalMap[$medicineName] = [
                'medicine' => $medicineName,
                'requests' => 0,
                'quantity' => 0,
            ];
        }
        $medicineSignalMap[$medicineName]['requests'] += 1;
        $medicineSignalMap[$medicineName]['quantity'] += $quantity;
    }

    $patternRows = array_values($diseaseSignalMap);
    mss_dashboard_sort_disease_rows($patternRows);

    $medicineRows = array_values($medicineSignalMap);
    usort($medicineRows, static function (array $left, array $right): int {
        $requestComparison = ((int) ($right['requests'] ?? 0)) <=> ((int) ($left['requests'] ?? 0));
        if ($requestComparison !== 0) {
            return $requestComparison;
        }

        $quantityComparison = ((int) ($right['quantity'] ?? 0)) <=> ((int) ($left['quantity'] ?? 0));
        if ($quantityComparison !== 0) {
            return $quantityComparison;
        }

        return strcmp((string) ($left['medicine'] ?? ''), (string) ($right['medicine'] ?? ''));
    });

    return [
        'patterns' => $patternRows,
        'medicines' => $medicineRows,
        'totalCases' => count($dispenseRows),
    ];
}

/**
 * @return array<string, array<string, mixed>>
 */
function mss_dashboard_build_disease_association_map(array $trainingRows, float $baselineFactor = 1.0): array
{
    $associationMap = [];

    foreach ($trainingRows as $row) {
        $label = mss_dashboard_text($row['label'] ?? '');
        $medicineKey = mss_dashboard_text($row['medicineKey'] ?? '');
        if ($medicineKey === '' || $label === '' || $label === 'Unspecified') {
            continue;
        }

        if (!isset($associationMap[$medicineKey])) {
            $associationMap[$medicineKey] = [
                'medicine' => mss_dashboard_text($row['medicineName'] ?? '') ?: 'Unknown medicine',
                'requests' => 0,
                'quantity' => 0,
                'patterns' => [],
            ];
        }

        $associationMap[$medicineKey]['requests'] += 1;
        $associationMap[$medicineKey]['quantity'] += max(0, mss_dashboard_int($row['quantity'] ?? 0));
        if (!isset($associationMap[$medicineKey]['patterns'][$label])) {
            $associationMap[$medicineKey]['patterns'][$label] = [
                'illness' => $label,
                'requests' => 0,
                'quantity' => 0,
            ];
        }
        $associationMap[$medicineKey]['patterns'][$label]['requests'] += 1;
        $associationMap[$medicineKey]['patterns'][$label]['quantity'] += max(0, mss_dashboard_int($row['quantity'] ?? 0));
    }

    foreach ($associationMap as $medicineKey => $entry) {
        $patternRows = array_values($entry['patterns'] ?? []);
        if ($patternRows === []) {
            unset($associationMap[$medicineKey]);
            continue;
        }

        mss_dashboard_sort_disease_rows($patternRows);
        $totalRequests = max(1, (int) ($entry['requests'] ?? 0));
        $dominantRequests = max(1, (int) ($patternRows[0]['requests'] ?? 0));
        $dominantShare = $dominantRequests / $totalRequests;
        $supportDepth = min(1.0, $totalRequests / 6.0);
        $reliability = max(0.12, min(1.0, $baselineFactor * (($supportDepth * 0.65) + ($dominantShare * 0.35))));

        foreach ($patternRows as $index => $patternRow) {
            $patternRows[$index]['share'] = ((int) ($patternRow['requests'] ?? 0)) / $totalRequests;
        }

        $entry['patterns'] = $patternRows;
        $entry['dominantIllness'] = mss_dashboard_text($patternRows[0]['illness'] ?? 'Unspecified') ?: 'Unspecified';
        $entry['dominantShare'] = $dominantShare;
        $entry['reliability'] = $reliability;
        $associationMap[$medicineKey] = $entry;
    }

    return $associationMap;
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_score_disease_window(array $windowRows, array $associationMap): array
{
    $signalMap = [];
    $medicineMap = [];
    $matchedRequests = 0;
    $windowTotalScore = 0.0;

    foreach ($windowRows as $row) {
        $medicineKey = mss_dashboard_text($row['medicineKey'] ?? '');
        if ($medicineKey === '' || !isset($associationMap[$medicineKey])) {
            continue;
        }

        $association = $associationMap[$medicineKey];
        $medicineName = mss_dashboard_text($row['medicineName'] ?? '') ?: 'Unknown medicine';
        $quantity = max(1, mss_dashboard_int($row['quantity'] ?? 0, 1));
        $eventImpact = 1.0 + min(1.5, $quantity / 10.0);
        $matchedRequests += 1;

        if (!isset($medicineMap[$medicineName])) {
            $medicineMap[$medicineName] = [
                'medicine' => $medicineName,
                'requests' => 0,
                'quantity' => 0,
                'mappedIllness' => mss_dashboard_text($association['dominantIllness'] ?? 'Unspecified') ?: 'Unspecified',
                'confidence' => 0,
            ];
        }
        $medicineMap[$medicineName]['requests'] += 1;
        $medicineMap[$medicineName]['quantity'] += $quantity;
        $medicineMap[$medicineName]['confidence'] = max(
            (int) ($medicineMap[$medicineName]['confidence'] ?? 0),
            (int) round((((float) ($association['dominantShare'] ?? 0.0)) * 0.55 + ((float) ($association['reliability'] ?? 0.0)) * 0.45) * 100)
        );

        foreach (($association['patterns'] ?? []) as $patternRow) {
            $illness = mss_dashboard_text($patternRow['illness'] ?? '');
            $share = mss_dashboard_float($patternRow['share'] ?? 0);
            if ($illness === '' || $share < 0.18) {
                continue;
            }

            $contribution = $share * mss_dashboard_float($association['reliability'] ?? 0) * $eventImpact;
            if ($contribution < 0.16) {
                continue;
            }

            if (!isset($signalMap[$illness])) {
                $signalMap[$illness] = [
                    'illness' => $illness,
                    'score' => 0.0,
                    'weightedQuantity' => 0.0,
                    'matchedRequests' => 0,
                    'associationShareTotal' => 0.0,
                    'associationReliabilityTotal' => 0.0,
                    'supportingMedicines' => [],
                    'latestAt' => '',
                    'latestTimestamp' => 0,
                ];
            }

            $signalMap[$illness]['score'] += $contribution;
            $signalMap[$illness]['weightedQuantity'] += $quantity * $share;
            $signalMap[$illness]['matchedRequests'] += 1;
            $signalMap[$illness]['associationShareTotal'] += $share;
            $signalMap[$illness]['associationReliabilityTotal'] += mss_dashboard_float($association['reliability'] ?? 0);
            $signalMap[$illness]['supportingMedicines'][$medicineName] = ($signalMap[$illness]['supportingMedicines'][$medicineName] ?? 0.0) + $contribution;

            $createdTimestamp = (int) ($row['createdTimestamp'] ?? 0);
            if ($createdTimestamp > (int) ($signalMap[$illness]['latestTimestamp'] ?? 0)) {
                $signalMap[$illness]['latestTimestamp'] = $createdTimestamp;
                $signalMap[$illness]['latestAt'] = mss_dashboard_text($row['createdAt'] ?? '');
            }

            $windowTotalScore += $contribution;
        }
    }

    $signalRows = [];
    foreach ($signalMap as $illness => $entry) {
        if (mss_dashboard_float($entry['score'] ?? 0) < 0.75) {
            continue;
        }

        arsort($entry['supportingMedicines']);
        $supportingRows = [];
        foreach ($entry['supportingMedicines'] as $medicineName => $supportScore) {
            $supportingRows[] = [
                'medicine' => $medicineName,
                'score' => round(mss_dashboard_float($supportScore), 2),
            ];
        }

        $supportingCount = count($supportingRows);
        $matchedCount = max(1, (int) ($entry['matchedRequests'] ?? 0));
        $supportBreadth = min(1.0, $supportingCount / 3.0);
        $scoreShare = $windowTotalScore > 0 ? mss_dashboard_float($entry['score'] ?? 0) / $windowTotalScore : 0.0;
        $averageShare = mss_dashboard_float($entry['associationShareTotal'] ?? 0) / $matchedCount;
        $averageReliability = mss_dashboard_float($entry['associationReliabilityTotal'] ?? 0) / $matchedCount;
        $confidenceRatio = min(0.96, max(0.18, ($scoreShare * 0.35) + ($averageShare * 0.25) + ($averageReliability * 0.25) + ($supportBreadth * 0.15)));

        $signalRows[] = [
            'illness' => $illness,
            'requests' => max(1, (int) round(mss_dashboard_float($entry['score'] ?? 0))),
            'mappedRequests' => round(mss_dashboard_float($entry['score'] ?? 0), 2),
            'quantity' => (int) round(mss_dashboard_float($entry['weightedQuantity'] ?? 0)),
            'confidence' => (int) round($confidenceRatio * 100),
            'supportingMedicines' => array_slice($supportingRows, 0, 3),
            'supportingCount' => $supportingCount,
            'supportingMedicineSummary' => mss_dashboard_summarize_supporting_medicines($supportingRows),
            'matchedRequests' => (int) ($entry['matchedRequests'] ?? 0),
            'latestAt' => mss_dashboard_text($entry['latestAt'] ?? ''),
            'basis' => 'inferred',
            'basisLabel' => 'Mapped from medicine frequency',
        ];
    }

    usort($signalRows, static function (array $left, array $right): int {
        $scoreComparison = mss_dashboard_float($right['mappedRequests'] ?? 0) <=> mss_dashboard_float($left['mappedRequests'] ?? 0);
        if ($scoreComparison !== 0) {
            return $scoreComparison;
        }

        $confidenceComparison = ((int) ($right['confidence'] ?? 0)) <=> ((int) ($left['confidence'] ?? 0));
        if ($confidenceComparison !== 0) {
            return $confidenceComparison;
        }

        return strcmp((string) ($left['illness'] ?? ''), (string) ($right['illness'] ?? ''));
    });

    $medicineRows = array_values($medicineMap);
    usort($medicineRows, static function (array $left, array $right): int {
        $requestComparison = ((int) ($right['requests'] ?? 0)) <=> ((int) ($left['requests'] ?? 0));
        if ($requestComparison !== 0) {
            return $requestComparison;
        }

        $quantityComparison = ((int) ($right['quantity'] ?? 0)) <=> ((int) ($left['quantity'] ?? 0));
        if ($quantityComparison !== 0) {
            return $quantityComparison;
        }

        $confidenceComparison = ((int) ($right['confidence'] ?? 0)) <=> ((int) ($left['confidence'] ?? 0));
        if ($confidenceComparison !== 0) {
            return $confidenceComparison;
        }

        return strcmp((string) ($left['medicine'] ?? ''), (string) ($right['medicine'] ?? ''));
    });

    return [
        'signals' => $signalRows,
        'medicines' => $medicineRows,
        'matchedRequests' => $matchedRequests,
        'windowTotalScore' => round($windowTotalScore, 2),
    ];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_disease_pattern(array $movements): array
{
    $dispenseRows = mss_dashboard_prepare_dispense_disease_rows($movements);
    $recorded = mss_dashboard_build_recorded_disease_pattern_rows($dispenseRows);

    $now = mss_dashboard_now();
    $recentCutoff = $now->modify('-30 days')->getTimestamp();
    $previousCutoff = $now->modify('-60 days')->getTimestamp();
    $labeledRows = array_values(array_filter(
        $dispenseRows,
        static fn (array $row): bool => mss_dashboard_text($row['label'] ?? '') !== '' && mss_dashboard_text($row['label'] ?? '') !== 'Unspecified'
    ));

    $trainingRows = array_values(array_filter(
        $labeledRows,
        static fn (array $row): bool => (int) ($row['createdTimestamp'] ?? 0) > 0 && (int) ($row['createdTimestamp'] ?? 0) < $previousCutoff
    ));
    $baselineLabel = 'older labeled dispense history';
    $baselineFactor = 1.0;

    $trainingPatternCount = count(array_unique(array_map(
        static fn (array $row): string => mss_dashboard_key($row['label'] ?? ''),
        $trainingRows
    )));
    if (count($trainingRows) < 8 || $trainingPatternCount < 2) {
        $trainingRows = array_values(array_filter(
            $labeledRows,
            static fn (array $row): bool => (int) ($row['createdTimestamp'] ?? 0) > 0 && (int) ($row['createdTimestamp'] ?? 0) < $recentCutoff
        ));
        $baselineLabel = 'recent labeled dispense history';
        $baselineFactor = 0.9;
        $trainingPatternCount = count(array_unique(array_map(
            static fn (array $row): string => mss_dashboard_key($row['label'] ?? ''),
            $trainingRows
        )));
    }
    if (count($trainingRows) < 6 || $trainingPatternCount < 2) {
        $trainingRows = $labeledRows;
        $baselineLabel = 'full labeled dispense history (bootstrap mode)';
        $baselineFactor = 0.75;
        $trainingPatternCount = count(array_unique(array_map(
            static fn (array $row): string => mss_dashboard_key($row['label'] ?? ''),
            $trainingRows
        )));
    }

    $associationMap = mss_dashboard_build_disease_association_map($trainingRows, $baselineFactor);
    $recentRows = array_values(array_filter(
        $dispenseRows,
        static fn (array $row): bool => (int) ($row['createdTimestamp'] ?? 0) >= $recentCutoff
    ));
    $previousRows = array_values(array_filter(
        $dispenseRows,
        static fn (array $row): bool => (int) ($row['createdTimestamp'] ?? 0) >= $previousCutoff && (int) ($row['createdTimestamp'] ?? 0) < $recentCutoff
    ));

    $recentSignals = $associationMap !== [] ? mss_dashboard_score_disease_window($recentRows, $associationMap) : ['signals' => [], 'medicines' => [], 'matchedRequests' => 0, 'windowTotalScore' => 0.0];
    $previousSignals = $associationMap !== [] ? mss_dashboard_score_disease_window($previousRows, $associationMap) : ['signals' => [], 'medicines' => [], 'matchedRequests' => 0, 'windowTotalScore' => 0.0];

    $previousSignalMap = [];
    foreach (($previousSignals['signals'] ?? []) as $row) {
        $previousSignalMap[mss_dashboard_key($row['illness'] ?? '')] = $row;
    }

    $inferredPatterns = [];
    foreach (($recentSignals['signals'] ?? []) as $row) {
        $patternKey = mss_dashboard_key($row['illness'] ?? '');
        $previousScore = mss_dashboard_float($previousSignalMap[$patternKey]['mappedRequests'] ?? 0);
        $currentScore = mss_dashboard_float($row['mappedRequests'] ?? 0);
        $growthPercent = $previousScore > 0
            ? (($currentScore - $previousScore) / $previousScore) * 100
            : ($currentScore > 0 ? 100.0 : 0.0);
        $trend = $previousScore <= 0
            ? 'new'
            : ($growthPercent >= 12 ? 'rising' : ($growthPercent <= -12 ? 'easing' : 'steady'));
        $trendLabel = match ($trend) {
            'rising' => 'Rising vs previous 30 days',
            'easing' => 'Lower vs previous 30 days',
            'new' => 'New signal this month',
            default => 'Steady vs previous 30 days',
        };

        $row['growthPercent'] = round($growthPercent, 1);
        $row['trend'] = $trend;
        $row['trendLabel'] = $trendLabel;
        $inferredPatterns[] = $row;
    }

    $hasInference = $inferredPatterns !== [];
    $displayPatterns = $hasInference ? $inferredPatterns : ($recorded['patterns'] ?? []);
    $displayMedicines = $hasInference ? ($recentSignals['medicines'] ?? []) : ($recorded['medicines'] ?? []);
    $panelNote = $hasInference
        ? 'Signals below are inferred from the last 30 days of medicine activity using ' . $baselineLabel . '.'
        : (($recorded['patterns'] ?? []) !== []
            ? 'Showing recorded illness cases while the system gathers enough older history to infer medicine-frequency signals.'
            : 'No disease pattern data yet. Start recording dispense cases to build this analysis.');

    return [
        'hasData' => $displayPatterns !== [],
        'mode' => $hasInference ? 'inferred' : 'recorded',
        'patterns' => $displayPatterns,
        'medicines' => $displayMedicines,
        'recordedPatterns' => $recorded['patterns'] ?? [],
        'recordedMedicines' => $recorded['medicines'] ?? [],
        'inferredPatterns' => $inferredPatterns,
        'inferredMedicines' => $recentSignals['medicines'] ?? [],
        'panelNote' => $panelNote,
        'summary' => [
            'totalPatterns' => count($displayPatterns),
            'totalDispenseCases' => (int) ($recorded['totalCases'] ?? 0),
            'trainingCases' => count($trainingRows),
            'trainingPatterns' => $trainingPatternCount,
            'trainingMedicines' => count($associationMap),
            'recentMatchedRequests' => (int) ($recentSignals['matchedRequests'] ?? 0),
            'previousMatchedRequests' => (int) ($previousSignals['matchedRequests'] ?? 0),
            'baselineLabel' => $baselineLabel,
            'windowDays' => 30,
        ],
        'emptyMessage' => $panelNote,
    ];
}

function mss_dashboard_summarize_medicine_names(array $items): string
{
    $labels = array_values(array_filter(array_map(
        static fn (array $item): string => mss_dashboard_text($item['medicineName'] ?? ''),
        $items
    )));

    if ($labels === []) {
        return 'No medicines listed';
    }
    if (count($labels) <= 2) {
        return implode(', ', $labels);
    }

    return implode(', ', array_slice($labels, 0, 2)) . ' +' . (count($labels) - 2) . ' more';
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_dashboard_request_deliveries(array $request, array $movements): array
{
    $requestId = mss_dashboard_text($request['id'] ?? '');
    $requestGroupId = mss_dashboard_text($request['requestGroupId'] ?? '');
    $requestCode = mss_dashboard_text($request['requestCode'] ?? '');
    $medicineId = mss_dashboard_text($request['medicineId'] ?? '');
    $medicineName = mss_dashboard_key($request['medicineName'] ?? '');

    $deliveries = array_values(array_filter($movements, static function (array $movement) use (
        $requestId,
        $requestGroupId,
        $requestCode,
        $medicineId,
        $medicineName
    ): bool {
        if (mss_dashboard_key($movement['actionType'] ?? '') !== 'restock') {
            return false;
        }

        $movementItemId = mss_dashboard_text($movement['linkedRequestItemId'] ?? '');
        $movementRequestId = mss_dashboard_text($movement['linkedRequestId'] ?? '');
        $movementGroupId = mss_dashboard_text($movement['linkedRequestGroupId'] ?? '');
        $movementCode = mss_dashboard_text($movement['linkedRequestCode'] ?? '');
        $movementMedicineId = mss_dashboard_text($movement['medicineId'] ?? '');
        $movementMedicineName = mss_dashboard_key($movement['medicineName'] ?? '');
        $matchesGroup = ($requestGroupId !== '' && $movementGroupId === $requestGroupId)
            || ($requestCode !== '' && $movementCode === $requestCode);
        $matchesMedicine = ($medicineId !== '' && $movementMedicineId === $medicineId)
            || ($medicineId === '' && $medicineName !== '' && $movementMedicineName === $medicineName);

        if ($requestId !== '' && $movementItemId === $requestId) {
            return true;
        }
        if ($requestId !== '' && $movementItemId === '' && $movementRequestId === $requestId) {
            return true;
        }
        if ($requestId === '' && $matchesGroup && $matchesMedicine) {
            return true;
        }

        return $requestId !== '' && $movementItemId !== $requestId && $matchesGroup && $matchesMedicine;
    }));

    usort($deliveries, static fn (array $left, array $right): int => strtotime((string) ($left['createdAt'] ?? '')) <=> strtotime((string) ($right['createdAt'] ?? '')));

    return $deliveries;
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_compute_request_progress(array $request, array $movements, string $today): array
{
    $deliveries = mss_dashboard_request_deliveries($request, $movements);
    $quantityRequested = max(1, mss_dashboard_int($request['quantityRequested'] ?? 1, 1));
    $requestDate = mss_dashboard_to_date_key($request['requestDate'] ?? '') ?: $today;
    $expectedDate = mss_dashboard_to_date_key($request['expectedDate'] ?? '') ?: $requestDate;
    $receivedQuantity = 0;
    $completionDate = '';

    foreach ($deliveries as $delivery) {
        $receivedQuantity += max(0, mss_dashboard_int($delivery['quantity'] ?? 0));
        if ($completionDate === '' && $receivedQuantity >= $quantityRequested) {
            $completionDate = mss_dashboard_to_date_key($delivery['createdAt'] ?? '');
        }
    }

    $remainingQuantity = max(0, $quantityRequested - $receivedQuantity);
    $lastDelivery = $deliveries !== [] ? $deliveries[count($deliveries) - 1] : null;
    $lastReceivedAt = mss_dashboard_text($lastDelivery['createdAt'] ?? '');
    $lastReceivedDate = $lastReceivedAt !== '' ? mss_dashboard_to_date_key($lastReceivedAt) : '';
    $todayTimestamp = strtotime($today . ' 00:00:00') ?: time();
    $expectedTimestamp = strtotime($expectedDate . ' 00:00:00') ?: $todayTimestamp;
    $completionTimestamp = $completionDate !== '' ? (strtotime($completionDate . ' 00:00:00') ?: null) : null;
    $isComplete = $receivedQuantity >= $quantityRequested;
    $hasDelivery = $receivedQuantity > 0;
    $isOverdue = !$isComplete && $todayTimestamp > $expectedTimestamp;
    $delayed = $isComplete && $completionTimestamp !== null && $completionTimestamp > $expectedTimestamp;
    $onTime = $isComplete && !$delayed;
    $incomplete = $hasDelivery && !$isComplete;
    $pending = !$hasDelivery;

    $statusKey = 'pending';
    $statusLabel = $isOverdue ? 'Overdue Request' : 'Pending Request';
    $tone = $isOverdue ? 'danger' : 'olive';

    if ($onTime) {
        $statusKey = 'on-time';
        $statusLabel = 'On Time Delivery';
        $tone = 'success';
    } elseif ($delayed) {
        $statusKey = 'delayed';
        $statusLabel = 'Delayed Delivery';
        $tone = 'danger';
    } elseif ($incomplete) {
        $statusKey = 'partial';
        $statusLabel = 'Incomplete Delivery';
        $tone = $isOverdue ? 'danger' : 'warning';
    }

    return array_merge($request, [
        'deliveries' => $deliveries,
        'receivedQuantity' => $receivedQuantity,
        'remainingQuantity' => $remainingQuantity,
        'completionDate' => $completionDate,
        'lastReceivedAt' => $lastReceivedAt,
        'lastReceivedDate' => $lastReceivedDate,
        'leadTimeDays' => $isComplete && $completionDate !== '' ? mss_dashboard_diff_days($requestDate, $completionDate) : null,
        'elapsedDays' => $hasDelivery && $lastReceivedDate !== ''
            ? mss_dashboard_diff_days($requestDate, $lastReceivedDate)
            : mss_dashboard_diff_days($requestDate, $today),
        'progressPercent' => min(100, (int) round(($receivedQuantity / $quantityRequested) * 100)),
        'isComplete' => $isComplete,
        'hasDelivery' => $hasDelivery,
        'isOverdue' => $isOverdue,
        'onTime' => $onTime,
        'delayed' => $delayed,
        'incomplete' => $incomplete,
        'pending' => $pending,
        'overdueDays' => ($isOverdue || $delayed)
            ? mss_dashboard_diff_days($expectedDate, $isComplete && $completionDate !== '' ? $completionDate : $today)
            : 0,
        'statusKey' => $statusKey,
        'statusLabel' => $statusLabel,
        'tone' => $tone,
    ]);
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_supply_analytics(array $requests, array $movements, ?DateTimeImmutable $now = null): array
{
    $referenceNow = $now ?? mss_dashboard_now();
    $today = $referenceNow->format('Y-m-d');
    $year = (int) $referenceNow->format('Y');
    $itemRows = array_map(
        static fn (array $request): array => mss_dashboard_compute_request_progress($request, $movements, $today),
        $requests
    );
    usort($itemRows, static fn (array $left, array $right): int => strtotime((string) ($right['requestDate'] ?? '')) <=> strtotime((string) ($left['requestDate'] ?? '')));

    $groupedRequests = [];
    foreach ($itemRows as $itemRow) {
        $groupId = mss_dashboard_text($itemRow['requestGroupId'] ?? '')
            ?: (mss_dashboard_text($itemRow['requestCode'] ?? '') ?: mss_dashboard_text($itemRow['id'] ?? ''));
        if ($groupId === '') {
            continue;
        }

        if (!isset($groupedRequests[$groupId])) {
            $groupedRequests[$groupId] = [];
        }
        $groupedRequests[$groupId][] = $itemRow;
    }

    $rows = [];
    foreach ($groupedRequests as $groupId => $items) {
        usort($items, static fn (array $left, array $right): int => strcmp((string) ($left['medicineName'] ?? ''), (string) ($right['medicineName'] ?? '')));
        $base = $items[0] ?? [];
        $itemCount = count($items);
        $completedItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['isComplete'] ?? false)));
        $deliveredItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['hasDelivery'] ?? false)));
        $pendingItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['pending'] ?? false)));
        $incompleteItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['incomplete'] ?? false) || ($item['statusKey'] ?? '') === 'partial'));
        $delayedItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['delayed'] ?? false)));
        $onTimeItems = count(array_filter($items, static fn (array $item): bool => (bool) ($item['onTime'] ?? false)));
        $totalRequestedQuantity = (int) array_reduce($items, static fn (int $total, array $item): int => $total + (int) ($item['quantityRequested'] ?? 0), 0);
        $totalReceivedQuantity = (int) array_reduce($items, static fn (int $total, array $item): int => $total + (int) ($item['receivedQuantity'] ?? 0), 0);
        $totalRemainingQuantity = (int) array_reduce($items, static fn (int $total, array $item): int => $total + (int) ($item['remainingQuantity'] ?? 0), 0);
        $hasDelivery = $deliveredItems > 0;
        $isComplete = $itemCount > 0 && $completedItems === $itemCount;
        $completionDates = array_values(array_filter(array_map(
            static fn (array $item): string => mss_dashboard_text($item['completionDate'] ?? ''),
            $items
        )));
        sort($completionDates);
        $receivedDates = array_values(array_filter(array_map(
            static fn (array $item): string => mss_dashboard_text($item['lastReceivedDate'] ?? ''),
            $items
        )));
        sort($receivedDates);
        $completionDate = $completionDates !== [] ? $completionDates[count($completionDates) - 1] : '';
        $lastReceivedDate = $receivedDates !== [] ? $receivedDates[count($receivedDates) - 1] : '';
        $requestDate = mss_dashboard_to_date_key($base['requestDate'] ?? '') ?: $today;
        $expectedDate = mss_dashboard_to_date_key($base['expectedDate'] ?? '') ?: $today;
        $todayTimestamp = strtotime($today . ' 00:00:00') ?: time();
        $expectedTimestamp = strtotime($expectedDate . ' 00:00:00') ?: $todayTimestamp;
        $isOverdue = !$isComplete && $todayTimestamp > $expectedTimestamp;
        $delayed = $isComplete && $delayedItems > 0;
        $onTime = $isComplete && $delayedItems === 0;
        $incomplete = $hasDelivery && !$isComplete;
        $pending = !$hasDelivery;
        $leadTimeDays = $isComplete && $completionDate !== '' ? mss_dashboard_diff_days($requestDate, $completionDate) : null;
        $elapsedDays = $hasDelivery && $lastReceivedDate !== ''
            ? mss_dashboard_diff_days($requestDate, $lastReceivedDate)
            : mss_dashboard_diff_days($requestDate, $today);

        $statusKey = 'pending';
        $statusLabel = $isOverdue ? 'Overdue Request' : 'Pending Request';
        $tone = $isOverdue ? 'danger' : 'olive';

        if ($onTime) {
            $statusKey = 'on-time';
            $statusLabel = 'On Time Delivery';
            $tone = 'success';
        } elseif ($delayed) {
            $statusKey = 'delayed';
            $statusLabel = 'Delayed Delivery';
            $tone = 'danger';
        } elseif ($incomplete) {
            $statusKey = 'incomplete';
            $statusLabel = 'Incomplete Delivery';
            $tone = $isOverdue ? 'danger' : 'warning';
        }

        $rows[] = [
            'id' => $groupId,
            'requestGroupId' => $groupId,
            'requestCode' => mss_dashboard_text($base['requestCode'] ?? ''),
            'requestDate' => $requestDate,
            'expectedDate' => $expectedDate,
            'source' => mss_dashboard_text($base['source'] ?? ''),
            'requestedBy' => mss_dashboard_text($base['requestedBy'] ?? ''),
            'notes' => mss_dashboard_text($base['notes'] ?? ''),
            'createdAt' => mss_dashboard_text($base['createdAt'] ?? ''),
            'updatedAt' => mss_dashboard_text($base['updatedAt'] ?? ''),
            'items' => $items,
            'itemCount' => $itemCount,
            'totalRequestedQuantity' => $totalRequestedQuantity,
            'totalReceivedQuantity' => $totalReceivedQuantity,
            'totalRemainingQuantity' => $totalRemainingQuantity,
            'completedItems' => $completedItems,
            'deliveredItems' => $deliveredItems,
            'pendingItems' => $pendingItems,
            'incompleteItems' => $incompleteItems,
            'delayedItems' => $delayedItems,
            'onTimeItems' => $onTimeItems,
            'hasDelivery' => $hasDelivery,
            'isComplete' => $isComplete,
            'isOverdue' => $isOverdue,
            'delayed' => $delayed,
            'onTime' => $onTime,
            'incomplete' => $incomplete,
            'pending' => $pending,
            'completionDate' => $completionDate,
            'lastReceivedDate' => $lastReceivedDate,
            'leadTimeDays' => $leadTimeDays,
            'elapsedDays' => $elapsedDays,
            'overdueDays' => ($isOverdue || $delayed)
                ? mss_dashboard_diff_days($expectedDate, $isComplete && $completionDate !== '' ? $completionDate : $today)
                : 0,
            'statusKey' => $statusKey,
            'statusLabel' => $statusLabel,
            'tone' => $tone,
            'medicineSummary' => mss_dashboard_summarize_medicine_names($items),
        ];
    }

    usort($rows, static fn (array $left, array $right): int => strtotime((string) ($right['requestDate'] ?? '')) <=> strtotime((string) ($left['requestDate'] ?? '')));

    $completedRows = array_values(array_filter($rows, static fn (array $row): bool => (bool) ($row['isComplete'] ?? false)));
    $onTimeRows = array_values(array_filter($rows, static fn (array $row): bool => (bool) ($row['onTime'] ?? false)));
    $delayedRows = array_values(array_filter($rows, static fn (array $row): bool => (bool) ($row['delayed'] ?? false)));
    $incompleteRows = array_values(array_filter($rows, static fn (array $row): bool => (bool) ($row['incomplete'] ?? false)));
    $pendingRows = array_values(array_filter($rows, static fn (array $row): bool => (bool) ($row['pending'] ?? false)));

    $allDeliveries = [];
    foreach ($itemRows as $itemRow) {
        foreach (($itemRow['deliveries'] ?? []) as $delivery) {
            $allDeliveries[] = $delivery;
        }
    }
    usort($allDeliveries, static fn (array $left, array $right): int => strtotime((string) ($right['createdAt'] ?? '')) <=> strtotime((string) ($left['createdAt'] ?? '')));
    $latestDelivery = $allDeliveries[0] ?? null;
    $averageLeadTime = $completedRows !== []
        ? round(mss_dashboard_average(array_map(static fn (array $row): float => mss_dashboard_float($row['leadTimeDays'] ?? 0), $completedRows)), 1)
        : 0.0;
    $onTimeRate = $completedRows !== []
        ? round((count($onTimeRows) / count($completedRows)) * 100, 1)
        : 0.0;

    $monthlyLeadTimes = [];
    for ($month = 1; $month <= 12; $month += 1) {
        $monthRows = array_values(array_filter($rows, static function (array $row) use ($year, $month): bool {
            if (!($row['isComplete'] ?? false) || mss_dashboard_text($row['completionDate'] ?? '') === '') {
                return false;
            }

            $completion = strtotime((string) ($row['completionDate'] ?? '') . ' 00:00:00');
            return $completion !== false
                && (int) date('Y', $completion) === $year
                && (int) date('n', $completion) === $month;
        }));

        $monthlyLeadTimes[] = $monthRows !== []
            ? round(mss_dashboard_average(array_map(static fn (array $row): float => mss_dashboard_float($row['leadTimeDays'] ?? 0), $monthRows)), 1)
            : 0.0;
    }

    return [
        'itemRows' => $itemRows,
        'rows' => $rows,
        'completedRows' => $completedRows,
        'summary' => [
            'totalRequests' => count($rows),
            'averageLeadTime' => $averageLeadTime,
            'onTimeCount' => count($onTimeRows),
            'delayedCount' => count($delayedRows),
            'incompleteCount' => count($incompleteRows),
            'pendingCount' => count($pendingRows),
            'completedCount' => count($completedRows),
            'onTimeRate' => $onTimeRate,
            'latestDeliveryDate' => $latestDelivery ? mss_dashboard_to_date_key($latestDelivery['createdAt'] ?? '') : '',
            'latestDeliveryAt' => $latestDelivery['createdAt'] ?? '',
        ],
        'monthlyLeadTimes' => $monthlyLeadTimes,
        'recentRows' => array_slice($rows, 0, 5),
        'emptyMessage' => 'No CHO requests logged yet.',
    ];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_admin_overview(PDO $pdo): array
{
    $now = mss_dashboard_now();
    $inventory = mss_dashboard_fetch_inventory_records($pdo);
    $movements = mss_dashboard_fetch_inventory_movements($pdo);
    $requests = mss_dashboard_fetch_requests($pdo);

    return [
        'generatedAt' => $now->format(DATE_ATOM),
        'demand' => mss_dashboard_build_demand_prediction($pdo),
        'diseasePattern' => mss_dashboard_build_disease_pattern($movements),
        'monitoringSnapshot' => mss_dashboard_build_monitoring_snapshot($inventory, $movements),
        'supply' => mss_dashboard_build_supply_analytics($requests, $movements, $now),
    ];
}

/**
 * @return array<string, mixed>
 */
function mss_dashboard_build_demand_prediction(PDO $pdo): array
{
    $now = new DateTimeImmutable('now');
    $currentMonthStart = new DateTimeImmutable('first day of this month 00:00:00');
    $windowStart = $currentMonthStart->modify('-12 months');
    $windowEnd = $currentMonthStart->modify('-1 day');

    $bucketKeys = [];
    $bucketIndexMap = [];
    $bucketMonthIndexMap = [];
    $monthLabels = [];

    for ($offset = 0; $offset < 12; $offset += 1) {
        $month = $windowStart->modify('+' . $offset . ' months');
        $bucketKey = $month->format('Y-m');

        $bucketKeys[] = $bucketKey;
        $bucketIndexMap[$bucketKey] = $offset;
        $bucketMonthIndexMap[$bucketKey] = (int) $month->format('n') - 1;
        $monthLabels[] = $month->format('M');
    }

    $inventoryRows = $pdo->query(
        'SELECT `id`, `name`, `form`, `strength`, `stock_on_hand`, `reorder_level`, `unit`, `record_status`
         FROM `mss_inventory_records`
         WHERE LOWER(`record_status`) = \'active\'
         ORDER BY `name` ASC, `strength` ASC, `form` ASC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $nameCounts = [];
    foreach ($inventoryRows as $row) {
        $normalizedName = mss_dashboard_key($row['name'] ?? '');
        if ($normalizedName === '') {
            continue;
        }

        $nameCounts[$normalizedName] = ($nameCounts[$normalizedName] ?? 0) + 1;
    }

    $inventoryIndexById = [];
    $inventoryIndexByLabel = [];
    $inventoryIndexByName = [];
    $medicines = [];

    foreach ($inventoryRows as $row) {
        $name = mss_dashboard_text($row['name'] ?? '');
        if ($name === '') {
            continue;
        }

        $strength = mss_dashboard_text($row['strength'] ?? '');
        $form = mss_dashboard_text($row['form'] ?? '') ?: 'Medicine';
        $normalizedName = mss_dashboard_key($name);
        $normalizedLabel = mss_dashboard_key(mss_dashboard_medicine_display_name($row));
        $id = mss_dashboard_text($row['id'] ?? '');
        $index = count($medicines);

        $medicines[] = [
            'id' => $id,
            'name' => $name,
            'displayName' => mss_dashboard_medicine_display_name($row),
            'detailLabel' => mss_dashboard_medicine_detail_label($row),
            'form' => $form,
            'strength' => $strength,
            'unit' => mss_dashboard_text($row['unit'] ?? '') ?: 'units',
            'stockOnHand' => mss_dashboard_int($row['stock_on_hand'] ?? 0),
            'reorderLevel' => mss_dashboard_int($row['reorder_level'] ?? 1, 1),
            'iconClass' => mss_dashboard_medicine_icon($form),
            'monthlyDemand' => array_fill(0, 12, 0),
        ];

        if ($id !== '') {
            $inventoryIndexById[$id] = $index;
        }
        if ($normalizedLabel !== '' && !isset($inventoryIndexByLabel[$normalizedLabel])) {
            $inventoryIndexByLabel[$normalizedLabel] = $index;
        }
        if (
            $normalizedName !== ''
            && ($nameCounts[$normalizedName] ?? 0) === 1
            && !isset($inventoryIndexByName[$normalizedName])
        ) {
            $inventoryIndexByName[$normalizedName] = $index;
        }
    }

    $movementStmt = $pdo->prepare(
        'SELECT `medicine_id`, `medicine_name`, DATE_FORMAT(`created_at`, \'%Y-%m\') AS `bucket_key`, SUM(`quantity`) AS `monthly_quantity`
         FROM `mss_inventory_movements`
         WHERE LOWER(`action_type`) = \'dispense\'
           AND `created_at` >= :window_start
           AND `created_at` < :window_end_exclusive
         GROUP BY `medicine_id`, `medicine_name`, DATE_FORMAT(`created_at`, \'%Y-%m\')
         ORDER BY `bucket_key` ASC'
    );
    $movementStmt->execute([
        ':window_start' => $windowStart->format('Y-m-d H:i:s'),
        ':window_end_exclusive' => $currentMonthStart->format('Y-m-d H:i:s'),
    ]);
    $movementRows = $movementStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($movementRows as $row) {
        $bucketKey = mss_dashboard_text($row['bucket_key'] ?? '');
        if (!isset($bucketIndexMap[$bucketKey])) {
            continue;
        }

        $movementIndex = null;
        $medicineId = mss_dashboard_text($row['medicine_id'] ?? '');
        if ($medicineId !== '' && isset($inventoryIndexById[$medicineId])) {
            $movementIndex = $inventoryIndexById[$medicineId];
        }

        if ($movementIndex === null) {
            $movementLabel = mss_dashboard_key($row['medicine_name'] ?? '');
            if ($movementLabel !== '' && isset($inventoryIndexByLabel[$movementLabel])) {
                $movementIndex = $inventoryIndexByLabel[$movementLabel];
            } elseif ($movementLabel !== '' && isset($inventoryIndexByName[$movementLabel])) {
                $movementIndex = $inventoryIndexByName[$movementLabel];
            }
        }

        if ($movementIndex === null) {
            continue;
        }

        $bucketIndex = $bucketIndexMap[$bucketKey];
        $medicines[$movementIndex]['monthlyDemand'][$bucketIndex] += mss_dashboard_int($row['monthly_quantity'] ?? 0);
    }

    $currentSeason = mss_dashboard_resolve_season((int) $now->format('n') - 1);
    $nextSeason = mss_dashboard_next_season((string) ($currentSeason['key'] ?? 'dry'));
    $forecastMedicines = [];

    foreach ($medicines as $medicine) {
        $monthlyDemand = array_map(
            static fn (mixed $value): int => (int) round(mss_dashboard_float($value)),
            $medicine['monthlyDemand']
        );
        $totalDemand = mss_dashboard_sum($monthlyDemand);
        if ($totalDemand <= 0) {
            continue;
        }

        $currentSeasonSeries = [];
        $nextSeasonSeries = [];
        foreach ($bucketKeys as $index => $bucketKey) {
            $monthIndex = $bucketMonthIndexMap[$bucketKey];
            $value = $monthlyDemand[$index] ?? 0;

            if (in_array($monthIndex, $currentSeason['months'], true)) {
                $currentSeasonSeries[] = $value;
            }
            if (in_array($monthIndex, $nextSeason['months'], true)) {
                $nextSeasonSeries[] = $value;
            }
        }

        $monthlyAverage = mss_dashboard_average($monthlyDemand);
        $currentSeasonAverage = mss_dashboard_average($currentSeasonSeries);
        $nextSeasonAverage = mss_dashboard_average($nextSeasonSeries);
        $nextSeasonShift = $currentSeasonAverage > 0
            ? (($nextSeasonAverage - $currentSeasonAverage) / $currentSeasonAverage) * 100
            : 0.0;
        $movingAverage = mss_dashboard_moving_average_forecast($monthlyDemand, 3);
        $smoothing = mss_dashboard_exponential_smoothing_forecast($monthlyDemand, 0.35);
        $forecast = (int) round(($movingAverage + $smoothing) / 2);
        $reorderTarget = (int) ceil($forecast + $medicine['reorderLevel']);
        $suggestedOrder = max(0, $reorderTarget - $medicine['stockOnHand']);
        $coverageMonths = $monthlyAverage > 0 ? $medicine['stockOnHand'] / $monthlyAverage : 0.0;

        $action = 'Ready';
        $actionNote = sprintf('Stock cover %.1f months.', $coverageMonths);

        if ($suggestedOrder > 0) {
            $action = 'Early Request';
            $actionNote = sprintf(
                'Request %d %s before the %s.',
                $suggestedOrder,
                $medicine['unit'],
                strtolower((string) ($nextSeason['label'] ?? 'next season'))
            );
        } elseif ($nextSeasonShift >= 15 && $medicine['stockOnHand'] < ($forecast * 2.4)) {
            $action = 'Build Buffer';
            $actionNote = sprintf(
                'Prepare extra stock for a %.0f%% %s shift.',
                $nextSeasonShift,
                strtolower((string) ($nextSeason['label'] ?? 'season'))
            );
        }

        $forecastMedicines[] = [
            'id' => $medicine['id'],
            'name' => $medicine['displayName'],
            'displayName' => $medicine['displayName'],
            'detailLabel' => $medicine['detailLabel'],
            'form' => $medicine['form'],
            'strength' => $medicine['strength'],
            'unit' => $medicine['unit'],
            'stockOnHand' => $medicine['stockOnHand'],
            'reorderLevel' => $medicine['reorderLevel'],
            'monthlyDemand' => $monthlyDemand,
            'monthlyAverage' => $monthlyAverage,
            'currentSeasonAverage' => $currentSeasonAverage,
            'nextSeasonAverage' => $nextSeasonAverage,
            'nextSeasonShift' => $nextSeasonShift,
            'movingAverage' => $movingAverage,
            'smoothing' => $smoothing,
            'forecast' => $forecast,
            'reorderTarget' => $reorderTarget,
            'suggestedOrder' => $suggestedOrder,
            'coverageMonths' => $coverageMonths,
            'action' => $action,
            'actionLabel' => mss_dashboard_action_label($action),
            'actionTone' => mss_dashboard_action_tone($action),
            'actionNote' => $actionNote,
            'iconClass' => $medicine['iconClass'],
        ];
    }

    usort($forecastMedicines, static function (array $left, array $right): int {
        $forecastComparison = ((int) ($right['forecast'] ?? 0)) <=> ((int) ($left['forecast'] ?? 0));
        if ($forecastComparison !== 0) {
            return $forecastComparison;
        }

        $averageComparison = mss_dashboard_float($right['monthlyAverage'] ?? 0) <=> mss_dashboard_float($left['monthlyAverage'] ?? 0);
        if ($averageComparison !== 0) {
            return $averageComparison;
        }

        return strcmp((string) ($left['displayName'] ?? ''), (string) ($right['displayName'] ?? ''));
    });

    $aggregateDemand = array_fill(0, 12, 0);
    foreach ($forecastMedicines as $medicine) {
        foreach ($medicine['monthlyDemand'] as $index => $value) {
            $aggregateDemand[$index] += (int) $value;
        }
    }

    $aggregateMovingAverage = mss_dashboard_moving_average_forecast($aggregateDemand, 3);
    $aggregateSmoothing = mss_dashboard_exponential_smoothing_forecast($aggregateDemand, 0.35);
    $combinedForecast = (int) round(($aggregateMovingAverage + $aggregateSmoothing) / 2);

    $aggregateCurrentSeasonSeries = [];
    $aggregateNextSeasonSeries = [];
    foreach ($bucketKeys as $index => $bucketKey) {
        $monthIndex = $bucketMonthIndexMap[$bucketKey];
        $value = $aggregateDemand[$index] ?? 0;

        if (in_array($monthIndex, $currentSeason['months'], true)) {
            $aggregateCurrentSeasonSeries[] = $value;
        }
        if (in_array($monthIndex, $nextSeason['months'], true)) {
            $aggregateNextSeasonSeries[] = $value;
        }
    }

    $currentSeasonAverage = mss_dashboard_average($aggregateCurrentSeasonSeries);
    $nextSeasonAverage = mss_dashboard_average($aggregateNextSeasonSeries);
    $seasonalShift = $currentSeasonAverage > 0
        ? (($nextSeasonAverage - $currentSeasonAverage) / $currentSeasonAverage) * 100
        : 0.0;
    $earlyReorderCount = count(array_filter(
        $forecastMedicines,
        static fn (array $medicine): bool => ($medicine['action'] ?? '') === 'Early Request'
    ));
    $historyMonthsWithDispense = count(array_filter(
        $aggregateDemand,
        static fn (int $value): bool => $value > 0
    ));
    $hasData = $historyMonthsWithDispense > 0 && $forecastMedicines !== [];
    $seasonalSummaryLabel = $seasonalShift >= 0
        ? 'Expected ' . ($nextSeason['label'] ?? 'Next Season') . ' Increase'
        : 'Expected ' . ($nextSeason['label'] ?? 'Next Season') . ' Decrease';

    $chartLabels = array_merge($monthLabels, ['Next']);
    $chartActualDemand = $hasData
        ? array_merge($aggregateDemand, [null])
        : array_fill(0, count($chartLabels), null);
    $chartPredictedDemand = $hasData
        ? array_merge(array_fill(0, 11, null), [$aggregateDemand[11] ?? 0, $combinedForecast])
        : array_fill(0, count($chartLabels), null);

    return [
        'hasData' => $hasData,
        'generatedAt' => $now->format(DATE_ATOM),
        'windowStart' => $windowStart->format('Y-m-d'),
        'windowEnd' => $windowEnd->format('Y-m-d'),
        'historyMonthsWithDispense' => $historyMonthsWithDispense,
        'currentSeason' => [
            'key' => $currentSeason['key'] ?? 'dry',
            'label' => $currentSeason['label'] ?? 'Dry Season',
        ],
        'nextSeason' => [
            'key' => $nextSeason['key'] ?? 'rainy',
            'label' => $nextSeason['label'] ?? 'Rainy Season',
            'iconClass' => $nextSeason['iconClass'] ?? 'bi bi-cloud-rain-heavy-fill',
        ],
        'summary' => [
            'predictedNextDemand' => $combinedForecast,
            'seasonalShiftPercent' => $seasonalShift,
            'seasonalSummaryLabel' => $seasonalSummaryLabel,
            'medicinesToWatch' => count($forecastMedicines),
            'medicinesToRequestSoon' => $earlyReorderCount,
        ],
        'chart' => [
            'labels' => $chartLabels,
            'actualDemand' => $chartActualDemand,
            'predictedDemand' => $chartPredictedDemand,
        ],
        'watchList' => $forecastMedicines,
        'forecastNote' => 'Based on the last 12 complete months of dispense activity using a 3-month moving average and exponential smoothing blend.',
        'emptyMessage' => 'No dispense history was found in the last 12 complete months. Start recording medicine releases to build demand prediction analytics.',
    ];
}

$pdo = mss_api_bootstrap(true);
$user = mss_auth_require_user($pdo);
if (mss_auth_user_role($user) !== 'admin') {
    mss_api_error('You are not allowed to access this dashboard analytics endpoint.', 403);
}

if (mss_api_request_method() !== 'GET') {
    mss_api_error('Method not allowed.', 405);
}

$scope = strtolower(mss_dashboard_text($_GET['scope'] ?? 'admin_overview'));
$allowedScopes = [
    'demand',
    'demand-prediction',
    'demand_prediction',
    'admin-overview',
    'admin_overview',
    'overview',
    'all',
];
if (!in_array($scope, $allowedScopes, true)) {
    mss_api_error('Unsupported analytics scope.', 400);
}

try {
    $responseScope = in_array($scope, ['demand', 'demand-prediction', 'demand_prediction'], true)
        ? 'demand_prediction'
        : 'admin_overview';
    $analytics = $responseScope === 'demand_prediction'
        ? mss_dashboard_build_demand_prediction($pdo)
        : mss_dashboard_build_admin_overview($pdo);

    mss_api_respond([
        'success' => true,
        'scope' => $responseScope,
        'analytics' => $analytics,
    ]);
} catch (Throwable $exception) {
    mss_api_error('Unable to load dashboard analytics right now.', 500);
}
