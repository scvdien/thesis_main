<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/db.php';

$apply = in_array('--apply', $argv ?? [], true);
$today = new DateTimeImmutable('today');
$seedKey = 'demo5m-' . $today->format('Ym');
$pdo = mss_db_connection();
mss_ensure_schema($pdo);

$medicines = $pdo->query(
    "SELECT `id`, `name`, `category`, `stock_on_hand`, `unit`
     FROM `mss_inventory_records`
     WHERE LOWER(`record_status`) = 'active'
     ORDER BY `name`, `id`"
)->fetchAll();
$bhws = $pdo->query(
    "SELECT `id`, `full_name`
     FROM `mss_users`
     WHERE LOWER(`role`) = 'bhw' AND LOWER(`status`) = 'active'
     ORDER BY `full_name`, `id`
     LIMIT 4"
)->fetchAll();
$residents = $pdo->query(
    "SELECT `id`, `resident_id`, `full_name`, `barangay`
     FROM `mss_resident_accounts`
     ORDER BY `full_name`, `id`"
)->fetchAll();

if (count($medicines) === 0) {
    throw new RuntimeException('No active medicines were found in inventory.');
}
if (count($bhws) < 4) {
    throw new RuntimeException('Four active BHW accounts are required. Found: ' . count($bhws));
}
if (count($residents) === 0) {
    throw new RuntimeException('No resident records were found for medicine recipients.');
}

$existingStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM `mss_inventory_movements` WHERE `id` LIKE :prefix"
);
$existingStmt->execute(['prefix' => $seedKey . '-%']);
$existingCount = (int) $existingStmt->fetchColumn();
if ($existingCount > 0) {
    echo "Sample history already exists ({$existingCount} records; seed {$seedKey}).\n";
    $summaryStmt = $pdo->prepare(
        "SELECT `released_by_name`, COUNT(*) AS `release_count`
         FROM `mss_inventory_movements`
         WHERE `id` LIKE :prefix
         GROUP BY `released_by_name`
         ORDER BY `released_by_name`"
    );
    $summaryStmt->execute(['prefix' => $seedKey . '-%']);
    foreach ($summaryStmt->fetchAll() as $summary) {
        echo "  {$summary['released_by_name']}: {$summary['release_count']} releases\n";
    }
    $monthStmt = $pdo->prepare(
        "SELECT DATE_FORMAT(`created_at`, '%Y-%m') AS `release_month`, COUNT(*) AS `release_count`
         FROM `mss_inventory_movements`
         WHERE `id` LIKE :prefix
         GROUP BY DATE_FORMAT(`created_at`, '%Y-%m')
         ORDER BY `release_month`"
    );
    $monthStmt->execute(['prefix' => $seedKey . '-%']);
    foreach ($monthStmt->fetchAll() as $summary) {
        echo "  {$summary['release_month']}: {$summary['release_count']} releases\n";
    }
    $recipientStmt = $pdo->prepare(
        "SELECT COALESCE(NULLIF(`recipient_barangay`, ''), '(blank)') AS `barangay`,
                COUNT(*) AS `release_count`
         FROM `mss_inventory_movements`
         WHERE `id` LIKE :prefix
         GROUP BY COALESCE(NULLIF(`recipient_barangay`, ''), '(blank)')
         ORDER BY `release_count` DESC, `barangay`"
    );
    $recipientStmt->execute(['prefix' => $seedKey . '-%']);
    foreach ($recipientStmt->fetchAll() as $summary) {
        echo "  Recipient barangay {$summary['barangay']}: {$summary['release_count']} releases\n";
    }
    $sourceStmt = $pdo->prepare(
        "SELECT COALESCE(NULLIF(r.`source`, ''), '(blank)') AS `resident_source`,
                COUNT(*) AS `release_count`
         FROM `mss_inventory_movements` m
         LEFT JOIN `mss_resident_accounts` r
           ON r.`resident_id` = m.`recipient_id` OR r.`id` = m.`recipient_id`
         WHERE m.`id` LIKE :prefix
         GROUP BY COALESCE(NULLIF(r.`source`, ''), '(blank)')
         ORDER BY `release_count` DESC, `resident_source`"
    );
    $sourceStmt->execute(['prefix' => $seedKey . '-%']);
    foreach ($sourceStmt->fetchAll() as $summary) {
        echo "  Resident source {$summary['resident_source']}: {$summary['release_count']} releases\n";
    }
    $sampleStmt = $pdo->prepare(
        "SELECT DISTINCT m.`recipient_name`
         FROM `mss_inventory_movements` m
         INNER JOIN `mss_resident_accounts` r
           ON r.`resident_id` = m.`recipient_id` OR r.`id` = m.`recipient_id`
         WHERE m.`id` LIKE :prefix
           AND LOWER(m.`recipient_barangay`) = 'cabarian'
           AND LOWER(r.`source`) = 'household-system'
         ORDER BY m.`recipient_name`
         LIMIT 5"
    );
    $sampleStmt->execute(['prefix' => $seedKey . '-%']);
    echo '  Sample Cabarian recipients: ' . implode(', ', array_column($sampleStmt->fetchAll(), 'recipient_name')) . "\n";
    exit(0);
}

$diseaseDetails = static function (array $medicine): array {
    $haystack = strtolower((string) ($medicine['name'] ?? '') . ' ' . (string) ($medicine['category'] ?? ''));
    return match (true) {
        str_contains($haystack, 'amoxic'), str_contains($haystack, 'antibi') =>
            ['Infectious Disease', 'Suspected bacterial infection'],
        str_contains($haystack, 'amlod'), str_contains($haystack, 'losartan'), str_contains($haystack, 'hypert') =>
            ['Cardiovascular', 'Hypertension maintenance'],
        str_contains($haystack, 'metformin'), str_contains($haystack, 'diabet') =>
            ['Metabolic', 'Diabetes maintenance'],
        str_contains($haystack, 'ors'), str_contains($haystack, 'oral rehydration') =>
            ['Gastrointestinal', 'Diarrhea and dehydration'],
        str_contains($haystack, 'lagundi'), str_contains($haystack, 'cough') =>
            ['Respiratory', 'Cough and colds'],
        str_contains($haystack, 'paracetamol'), str_contains($haystack, 'analges') =>
            ['General', 'Fever and body pain'],
        str_contains($haystack, 'vitamin') =>
            ['Nutrition', 'Vitamin supplementation'],
        default =>
            ['General', 'Community health consultation'],
    };
};

$records = [];
$sequence = 1;
$monthStart = $today->modify('first day of this month')->modify('-4 months');
for ($monthIndex = 0; $monthIndex < 5; $monthIndex++) {
    $currentMonth = $monthStart->modify("+{$monthIndex} months");
    $daysInMonth = (int) $currentMonth->format('t');

    foreach ($bhws as $bhwIndex => $bhw) {
        for ($releaseIndex = 0; $releaseIndex < 8; $releaseIndex++) {
            $medicineIndex = ($monthIndex * 7 + $bhwIndex * 3 + $releaseIndex) % count($medicines);
            $residentIndex = ($monthIndex * 19 + $bhwIndex * 11 + $releaseIndex * 5) % count($residents);
            $medicine = $medicines[$medicineIndex];
            $resident = $residents[$residentIndex];
            $quantity = 1 + (($monthIndex + $bhwIndex + $releaseIndex * 2) % 8);
            $day = 2 + (($bhwIndex * 6 + $releaseIndex * 3 + $monthIndex) % max(1, $daysInMonth - 3));
            $hour = 8 + (($bhwIndex + $releaseIndex) % 8);
            $minute = (($releaseIndex * 7) + ($bhwIndex * 11)) % 60;
            $createdAt = $currentMonth->setDate(
                (int) $currentMonth->format('Y'),
                (int) $currentMonth->format('m'),
                min($day, $daysInMonth)
            )->setTime($hour, $minute);
            if ($createdAt > $today->setTime(17, 0)) {
                continue;
            }

            [$diseaseCategory, $illness] = $diseaseDetails($medicine);
            $records[] = [
                'id' => sprintf('%s-%04d', $seedKey, $sequence++),
                'medicine' => $medicine,
                'bhw' => $bhw,
                'resident' => $resident,
                'quantity' => $quantity,
                'disease_category' => $diseaseCategory,
                'illness' => $illness,
                'created_at' => $createdAt,
            ];
        }
    }
}

usort($records, static fn(array $a, array $b): int => $a['created_at'] <=> $b['created_at']);
$releasedTotals = [];
foreach ($records as $record) {
    $medicineId = (string) $record['medicine']['id'];
    $releasedTotals[$medicineId] = ($releasedTotals[$medicineId] ?? 0) + (int) $record['quantity'];
}

$runningStocks = [];
foreach ($medicines as $medicine) {
    $medicineId = (string) $medicine['id'];
    $runningStocks[$medicineId] = (int) $medicine['stock_on_hand'] + ($releasedTotals[$medicineId] ?? 0);
}

echo "Five-month range: {$monthStart->format('Y-m-d')} to {$today->format('Y-m-d')}\n";
echo 'BHWs: ' . implode(', ', array_column($bhws, 'full_name')) . "\n";
echo 'Active medicines: ' . count($medicines) . "\n";
echo 'Residents available: ' . count($residents) . "\n";
echo 'Dispensing records to add: ' . count($records) . "\n";

if (!$apply) {
    echo "Dry run only. Run again with --apply to insert the sample history.\n";
    exit(0);
}

$insert = $pdo->prepare(
    'INSERT INTO `mss_inventory_movements`
        (`id`, `medicine_id`, `medicine_name`, `action_type`, `quantity`,
         `disease_category`, `illness`, `note`, `stock_before`, `stock_after`,
         `created_at`, `user_name`, `recipient_id`, `recipient_name`,
         `recipient_barangay`, `released_by_role`, `released_by_name`,
         `linked_request_id`, `linked_request_item_id`, `linked_request_group_id`,
         `linked_request_code`)
     VALUES
        (:id, :medicine_id, :medicine_name, "dispense", :quantity,
         :disease_category, :illness, :note, :stock_before, :stock_after,
         :created_at, :user_name, :recipient_id, :recipient_name,
         :recipient_barangay, "BHW", :released_by_name,
         "", "", "", "")'
);
$updateResident = $pdo->prepare(
    'UPDATE `mss_resident_accounts`
     SET `last_dispensed_at` = :created_at, `last_dispensed_medicine` = :medicine_name
     WHERE `id` = :id
       AND (`last_dispensed_at` IS NULL OR `last_dispensed_at` < :created_at_compare)'
);

$pdo->beginTransaction();
try {
    foreach ($records as $record) {
        $medicine = $record['medicine'];
        $bhw = $record['bhw'];
        $resident = $record['resident'];
        $medicineId = (string) $medicine['id'];
        $stockBefore = $runningStocks[$medicineId];
        $stockAfter = $stockBefore - (int) $record['quantity'];
        $runningStocks[$medicineId] = $stockAfter;
        $createdAt = $record['created_at']->format('Y-m-d H:i:s');

        $insert->execute([
            'id' => $record['id'],
            'medicine_id' => $medicineId,
            'medicine_name' => $medicine['name'],
            'quantity' => $record['quantity'],
            'disease_category' => $record['disease_category'],
            'illness' => $record['illness'],
            'note' => 'Sample historical release based on a barangay health consultation.',
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'created_at' => $createdAt,
            'user_name' => $bhw['full_name'],
            'recipient_id' => $resident['resident_id'] ?: $resident['id'],
            'recipient_name' => $resident['full_name'],
            'recipient_barangay' => $resident['barangay'],
            'released_by_name' => $bhw['full_name'],
        ]);

        $updateResident->execute([
            'id' => $resident['id'],
            'created_at' => $createdAt,
            'created_at_compare' => $createdAt,
            'medicine_name' => $medicine['name'],
        ]);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

echo 'Inserted ' . count($records) . " sample dispensing records successfully.\n";
