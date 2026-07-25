<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/db.php';

$apply = in_array('--apply', $argv ?? [], true);
$pdo = mss_db_connection();
mss_ensure_schema($pdo);

$locations = [
    [
        'barangay' => 'Catburawan',
        'city' => 'Ligao City',
        'province' => 'Albay',
        'people' => [
            ['Marites B. Aguilar', 'Purok 1'],
            ['Roberto M. Arcilla', 'Purok 2'],
            ['Jocelyn R. Bragais', 'Purok 3'],
            ['Edgar L. Borbe', 'Purok 4'],
            ['Rosalinda P. Cañete', 'Purok 5'],
            ['Noel S. Dela Peña', 'Purok 6'],
        ],
    ],
    [
        'barangay' => 'Badian',
        'city' => 'Oas',
        'province' => 'Albay',
        'people' => [
            ['Lorna A. Bañares', 'Purok 1'],
            ['Rogelio D. Belleza', 'Purok 2'],
            ['Merlinda C. Camacho', 'Purok 3'],
            ['Renato G. Dacara', 'Purok 4'],
            ['Helen T. Esplana', 'Purok 5'],
            ['Danilo V. Flores', 'Purok 6'],
        ],
    ],
    [
        'barangay' => 'Maonon',
        'city' => 'Ligao City',
        'province' => 'Albay',
        'people' => [
            ['Nenita F. Garcia', 'Purok 1'],
            ['Antonio R. Gonzales', 'Purok 2'],
            ['Elena M. Hernandez', 'Purok 3'],
            ['Mario P. Imperial', 'Purok 4'],
            ['Teresa L. Jaucian', 'Purok 5'],
            ['Eduardo S. Llanes', 'Purok 6'],
        ],
    ],
];

$externalResidents = [];
$residentSequence = 1;
foreach ($locations as $location) {
    foreach ($location['people'] as [$name, $purok]) {
        $residentId = sprintf('EXT-2026-%04d', $residentSequence);
        $externalResidents[] = [
            'id' => 'external-resident-' . $residentSequence,
            'resident_id' => $residentId,
            'full_name' => $name,
            'barangay' => $location['barangay'],
            'zone' => $purok,
            'city' => $location['city'],
            'province' => $location['province'],
            'address' => "{$purok}, Barangay {$location['barangay']}, {$location['city']}, {$location['province']}",
            'source' => 'external-walk-in',
        ];
        $residentSequence++;
    }
}

$movementRows = $pdo->query(
    "SELECT `id`, `recipient_id`, `created_at`
     FROM `mss_inventory_movements`
     WHERE `id` LIKE 'demo5m-%'
     ORDER BY `created_at`, `id`"
)->fetchAll();
if (count($movementRows) < 36) {
    throw new RuntimeException('At least 36 five-month sample release records are required.');
}

$byMonth = [];
foreach ($movementRows as $movement) {
    $month = substr((string) $movement['created_at'], 0, 7);
    $byMonth[$month][] = $movement;
}
ksort($byMonth);

$selectedMovements = [];
$monthIndex = 0;
foreach ($byMonth as $monthRows) {
    $target = $monthIndex === count($byMonth) - 1 ? 8 : 7;
    $count = count($monthRows);
    for ($index = 0; $index < $target; $index++) {
        $position = min($count - 1, (int) floor(($index + 0.5) * $count / $target));
        $selectedMovements[] = $monthRows[$position];
    }
    $monthIndex++;
}
$selectedMovements = array_slice($selectedMovements, 0, 36);

echo "External residents to store: " . count($externalResidents) . "\n";
foreach ($locations as $location) {
    echo "  {$location['barangay']}, {$location['city']}, {$location['province']}: "
        . count($location['people']) . " residents\n";
}
echo "Existing releases to link to external residents: " . count($selectedMovements) . "\n";

if (!$apply) {
    echo "Dry run only. Run again with --apply to save the residents and release links.\n";
    exit(0);
}

$insertResident = $pdo->prepare(
    'INSERT INTO `mss_resident_accounts`
        (`id`, `resident_id`, `household_id`, `full_name`, `barangay`, `zone`,
         `city`, `province`, `address`, `source`, `last_dispensed_at`,
         `last_dispensed_medicine`)
     VALUES
        (:id, :resident_id, "", :full_name, :barangay, :zone,
         :city, :province, :address, :source, NULL, "")
     ON DUPLICATE KEY UPDATE
        `resident_id` = VALUES(`resident_id`),
        `full_name` = VALUES(`full_name`),
        `barangay` = VALUES(`barangay`),
        `zone` = VALUES(`zone`),
        `city` = VALUES(`city`),
        `province` = VALUES(`province`),
        `address` = VALUES(`address`),
        `source` = VALUES(`source`)'
);
$updateMovement = $pdo->prepare(
    'UPDATE `mss_inventory_movements`
     SET `recipient_id` = :recipient_id,
         `recipient_name` = :recipient_name,
         `recipient_barangay` = :recipient_barangay
     WHERE `id` = :id'
);
$latestMovement = $pdo->prepare(
    'SELECT `created_at`, `medicine_name`
     FROM `mss_inventory_movements`
     WHERE `recipient_id` = :recipient_id
     ORDER BY `created_at` DESC, `id` DESC
     LIMIT 1'
);
$updateLastDispensed = $pdo->prepare(
    'UPDATE `mss_resident_accounts`
     SET `last_dispensed_at` = :last_dispensed_at,
         `last_dispensed_medicine` = :last_dispensed_medicine
     WHERE `resident_id` = :resident_id OR `id` = :resident_id_match'
);

$pdo->beginTransaction();
try {
    foreach ($externalResidents as $resident) {
        $insertResident->execute($resident);
    }

    $affectedOriginalRecipientIds = [];
    foreach ($selectedMovements as $index => $movement) {
        $resident = $externalResidents[$index % count($externalResidents)];
        $affectedOriginalRecipientIds[] = (string) $movement['recipient_id'];
        $updateMovement->execute([
            'id' => $movement['id'],
            'recipient_id' => $resident['resident_id'],
            'recipient_name' => $resident['full_name'],
            'recipient_barangay' => $resident['barangay'],
        ]);
    }

    $recipientIdsToRefresh = array_values(array_unique(array_merge(
        $affectedOriginalRecipientIds,
        array_column($externalResidents, 'resident_id')
    )));
    foreach ($recipientIdsToRefresh as $recipientId) {
        $latestMovement->execute(['recipient_id' => $recipientId]);
        $latest = $latestMovement->fetch();
        $updateLastDispensed->execute([
            'resident_id' => $recipientId,
            'resident_id_match' => $recipientId,
            'last_dispensed_at' => is_array($latest) ? $latest['created_at'] : null,
            'last_dispensed_medicine' => is_array($latest) ? $latest['medicine_name'] : '',
        ]);
    }

    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

echo "Stored 18 external resident records and linked 36 dispensing records successfully.\n";
