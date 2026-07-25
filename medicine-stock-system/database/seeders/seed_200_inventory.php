<?php
declare(strict_types=1);

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'db.php';

const MSS_DEMO_INVENTORY_SIZE = 200;
const MSS_DEMO_SKUS_PER_MEDICINE = 4;

/**
 * Deterministic demo catalog used for system demonstrations and load testing.
 *
 * These records are sample inventory data only and are not prescribing guidance.
 *
 * @return array<int, array{name: string, category: string, form: string, strength: string, unit: string, base_cost: float}>
 */
function mss_demo_medicine_profiles(): array
{
    return [
        ['name' => 'Paracetamol', 'category' => 'Analgesic', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 1.25],
        ['name' => 'Ibuprofen', 'category' => 'Analgesic', 'form' => 'Tablet', 'strength' => '200 mg', 'unit' => 'tablets', 'base_cost' => 2.10],
        ['name' => 'Mefenamic Acid', 'category' => 'Analgesic', 'form' => 'Capsule', 'strength' => '500 mg', 'unit' => 'capsules', 'base_cost' => 3.25],
        ['name' => 'Aspirin', 'category' => 'Analgesic', 'form' => 'Tablet', 'strength' => '80 mg', 'unit' => 'tablets', 'base_cost' => 1.80],
        ['name' => 'Naproxen', 'category' => 'Analgesic', 'form' => 'Tablet', 'strength' => '250 mg', 'unit' => 'tablets', 'base_cost' => 4.50],
        ['name' => 'Amoxicillin', 'category' => 'Antibiotics', 'form' => 'Capsule', 'strength' => '500 mg', 'unit' => 'capsules', 'base_cost' => 5.20],
        ['name' => 'Azithromycin', 'category' => 'Antibiotics', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 18.00],
        ['name' => 'Cefalexin', 'category' => 'Antibiotics', 'form' => 'Capsule', 'strength' => '500 mg', 'unit' => 'capsules', 'base_cost' => 7.50],
        ['name' => 'Cefuroxime', 'category' => 'Antibiotics', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 28.00],
        ['name' => 'Cotrimoxazole', 'category' => 'Antibiotics', 'form' => 'Tablet', 'strength' => '800 mg / 160 mg', 'unit' => 'tablets', 'base_cost' => 4.75],
        ['name' => 'Metronidazole', 'category' => 'Antibiotics', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 3.90],
        ['name' => 'Ciprofloxacin', 'category' => 'Antibiotics', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 8.25],
        ['name' => 'Doxycycline', 'category' => 'Antibiotics', 'form' => 'Capsule', 'strength' => '100 mg', 'unit' => 'capsules', 'base_cost' => 4.40],
        ['name' => 'Clindamycin', 'category' => 'Antibiotics', 'form' => 'Capsule', 'strength' => '300 mg', 'unit' => 'capsules', 'base_cost' => 9.75],
        ['name' => 'Ampicillin', 'category' => 'Antibiotics', 'form' => 'Capsule', 'strength' => '500 mg', 'unit' => 'capsules', 'base_cost' => 5.00],
        ['name' => 'Cetirizine', 'category' => 'Antihistamine', 'form' => 'Tablet', 'strength' => '10 mg', 'unit' => 'tablets', 'base_cost' => 2.00],
        ['name' => 'Loratadine', 'category' => 'Antihistamine', 'form' => 'Tablet', 'strength' => '10 mg', 'unit' => 'tablets', 'base_cost' => 3.25],
        ['name' => 'Diphenhydramine', 'category' => 'Antihistamine', 'form' => 'Capsule', 'strength' => '25 mg', 'unit' => 'capsules', 'base_cost' => 2.80],
        ['name' => 'Chlorphenamine', 'category' => 'Antihistamine', 'form' => 'Tablet', 'strength' => '4 mg', 'unit' => 'tablets', 'base_cost' => 1.30],
        ['name' => 'Fexofenadine', 'category' => 'Antihistamine', 'form' => 'Tablet', 'strength' => '120 mg', 'unit' => 'tablets', 'base_cost' => 12.00],
        ['name' => 'Ascorbic Acid', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 2.25],
        ['name' => 'Ferrous Sulfate', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => '325 mg', 'unit' => 'tablets', 'base_cost' => 1.75],
        ['name' => 'Folic Acid', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => '5 mg', 'unit' => 'tablets', 'base_cost' => 1.10],
        ['name' => 'Calcium Carbonate', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 3.50],
        ['name' => 'Vitamin B Complex', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => 'Standard dose', 'unit' => 'tablets', 'base_cost' => 2.40],
        ['name' => 'Zinc Sulfate', 'category' => 'Vitamins', 'form' => 'Tablet', 'strength' => '20 mg', 'unit' => 'tablets', 'base_cost' => 2.10],
        ['name' => 'Vitamin A', 'category' => 'Vitamins', 'form' => 'Capsule', 'strength' => '100,000 IU', 'unit' => 'capsules', 'base_cost' => 4.25],
        ['name' => 'Cholecalciferol', 'category' => 'Vitamins', 'form' => 'Capsule', 'strength' => '1,000 IU', 'unit' => 'capsules', 'base_cost' => 4.00],
        ['name' => 'Oral Rehydration Salts', 'category' => 'Hydration', 'form' => 'Sachet', 'strength' => '20.5 g', 'unit' => 'sachets', 'base_cost' => 6.50],
        ['name' => 'Dextrose Powder', 'category' => 'Hydration', 'form' => 'Sachet', 'strength' => '50 g', 'unit' => 'sachets', 'base_cost' => 8.00],
        ['name' => 'Amlodipine', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '5 mg', 'unit' => 'tablets', 'base_cost' => 2.25],
        ['name' => 'Losartan', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '50 mg', 'unit' => 'tablets', 'base_cost' => 4.75],
        ['name' => 'Metformin', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '500 mg', 'unit' => 'tablets', 'base_cost' => 2.60],
        ['name' => 'Gliclazide', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '80 mg', 'unit' => 'tablets', 'base_cost' => 4.50],
        ['name' => 'Atorvastatin', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '20 mg', 'unit' => 'tablets', 'base_cost' => 5.75],
        ['name' => 'Simvastatin', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '20 mg', 'unit' => 'tablets', 'base_cost' => 3.60],
        ['name' => 'Hydrochlorothiazide', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '25 mg', 'unit' => 'tablets', 'base_cost' => 1.50],
        ['name' => 'Enalapril', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '10 mg', 'unit' => 'tablets', 'base_cost' => 2.20],
        ['name' => 'Carvedilol', 'category' => 'Maintenance', 'form' => 'Tablet', 'strength' => '6.25 mg', 'unit' => 'tablets', 'base_cost' => 5.25],
        ['name' => 'Omeprazole', 'category' => 'Maintenance', 'form' => 'Capsule', 'strength' => '20 mg', 'unit' => 'capsules', 'base_cost' => 3.75],
        ['name' => 'Salbutamol', 'category' => 'Respiratory', 'form' => 'Tablet', 'strength' => '2 mg', 'unit' => 'tablets', 'base_cost' => 1.80],
        ['name' => 'Ambroxol', 'category' => 'Respiratory', 'form' => 'Tablet', 'strength' => '30 mg', 'unit' => 'tablets', 'base_cost' => 2.50],
        ['name' => 'Carbocisteine', 'category' => 'Respiratory', 'form' => 'Capsule', 'strength' => '500 mg', 'unit' => 'capsules', 'base_cost' => 4.25],
        ['name' => 'Dextromethorphan', 'category' => 'Respiratory', 'form' => 'Syrup', 'strength' => '15 mg / 5 mL', 'unit' => 'bottles', 'base_cost' => 48.00],
        ['name' => 'Guaifenesin', 'category' => 'Respiratory', 'form' => 'Syrup', 'strength' => '100 mg / 5 mL', 'unit' => 'bottles', 'base_cost' => 45.00],
        ['name' => 'Lagundi', 'category' => 'Herbal', 'form' => 'Syrup', 'strength' => '300 mg / 5 mL', 'unit' => 'bottles', 'base_cost' => 55.00],
        ['name' => 'Sambong', 'category' => 'Herbal', 'form' => 'Tablet', 'strength' => '250 mg', 'unit' => 'tablets', 'base_cost' => 3.50],
        ['name' => 'Tsaang Gubat', 'category' => 'Herbal', 'form' => 'Tablet', 'strength' => '250 mg', 'unit' => 'tablets', 'base_cost' => 3.25],
        ['name' => 'Loperamide', 'category' => 'Others', 'form' => 'Capsule', 'strength' => '2 mg', 'unit' => 'capsules', 'base_cost' => 2.40],
        ['name' => 'Hyoscine Butylbromide', 'category' => 'Others', 'form' => 'Tablet', 'strength' => '10 mg', 'unit' => 'tablets', 'base_cost' => 5.50],
    ];
}

/**
 * Fictional supplier labels used to distinguish inventory variants.
 *
 * @return array<int, string>
 */
function mss_inventory_supplier_labels(): array
{
    return [
        'Aster Laboratories',
        'Bellmont Pharma',
        'Crestwell Healthcare',
        'DeltaCare Generics',
    ];
}

function mss_demo_expiry_date(int $sequence): string
{
    $base = new DateTimeImmutable('2027-01-01');
    return $base->modify('+' . (($sequence * 11) % 900) . ' days')->format('Y-m-d');
}

function mss_inventory_batch_number(int $profileNumber, int $sku, int $sequence): string
{
    $year = 26 + intdiv($sequence - 1, 400);
    $month = (($sequence * 7) % 12) + 1;
    $lotCode = 1000 + (($sequence * 7919) % 9000);

    return sprintf('LOT-%02d%02d-%02d%02d-%04d', $year, $month, $profileNumber, $sku, $lotCode);
}

function mss_seed_demo_inventory(PDO $pdo, bool $resetExisting = false): array
{
    $profiles = mss_demo_medicine_profiles();
    $supplierLabels = mss_inventory_supplier_labels();
    $expectedProfiles = intdiv(MSS_DEMO_INVENTORY_SIZE, MSS_DEMO_SKUS_PER_MEDICINE);

    if (count($profiles) !== $expectedProfiles) {
        throw new RuntimeException(sprintf(
            'Expected %d medicine profiles, found %d.',
            $expectedProfiles,
            count($profiles)
        ));
    }
    if (count($supplierLabels) !== MSS_DEMO_SKUS_PER_MEDICINE) {
        throw new RuntimeException(sprintf(
            'Expected %d supplier labels, found %d.',
            MSS_DEMO_SKUS_PER_MEDICINE,
            count($supplierLabels)
        ));
    }

    $sql = <<<'SQL'
INSERT INTO `mss_inventory_records`
    (`id`, `name`, `generic_name`, `category`, `form`, `strength`, `stock_on_hand`,
     `reorder_level`, `unit`, `batch_number`, `expiry_date`, `unit_cost`,
     `record_status`, `updated_by`, `last_updated_at`)
VALUES
    (:id, :name, :generic_name, :category, :form, :strength, :stock_on_hand,
     :reorder_level, :unit, :batch_number, :expiry_date, :unit_cost,
     'active', 'Inventory Administrator', NOW())
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `generic_name` = VALUES(`generic_name`),
    `category` = VALUES(`category`),
    `form` = VALUES(`form`),
    `strength` = VALUES(`strength`),
    `stock_on_hand` = VALUES(`stock_on_hand`),
    `reorder_level` = VALUES(`reorder_level`),
    `unit` = VALUES(`unit`),
    `batch_number` = VALUES(`batch_number`),
    `expiry_date` = VALUES(`expiry_date`),
    `unit_cost` = VALUES(`unit_cost`),
    `record_status` = 'active',
    `updated_by` = 'Inventory Administrator',
    `last_updated_at` = NOW()
SQL;

    $statement = $pdo->prepare($sql);
    $sequence = 0;

    $pdo->beginTransaction();
    try {
        if ($resetExisting) {
            $pdo->exec('DELETE FROM `mss_inventory_records`');
            $pdo->exec('DELETE FROM `mss_notifications`');
            $pdo->exec("DELETE FROM `mss_client_state` WHERE `state_key` LIKE 'notification%'");
        }

        foreach ($profiles as $profileIndex => $profile) {
            for ($sku = 1; $sku <= MSS_DEMO_SKUS_PER_MEDICINE; $sku++) {
                $sequence++;
                $stock = 40 + (($sequence * 37) % 461);
                $reorderLevel = 25 + (($sequence * 13) % 76);
                $costMultiplier = 1 + (($sku - 1) * 0.015);

                $statement->execute([
                    ':id' => sprintf('demo_medicine_%04d', $sequence),
                    ':name' => sprintf('%s - %s', $profile['name'], $supplierLabels[$sku - 1]),
                    ':generic_name' => $profile['name'],
                    ':category' => $profile['category'],
                    ':form' => $profile['form'],
                    ':strength' => $profile['strength'],
                    ':stock_on_hand' => $stock,
                    ':reorder_level' => $reorderLevel,
                    ':unit' => $profile['unit'],
                    ':batch_number' => mss_inventory_batch_number($profileIndex + 1, $sku, $sequence),
                    ':expiry_date' => mss_demo_expiry_date($sequence),
                    ':unit_cost' => number_format($profile['base_cost'] * $costMultiplier, 2, '.', ''),
                ]);
            }
        }

        if ($sequence !== MSS_DEMO_INVENTORY_SIZE) {
            throw new RuntimeException(sprintf(
                'Seeder generated %d records instead of %d.',
                $sequence,
                MSS_DEMO_INVENTORY_SIZE
            ));
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    $seededCountStatement = $pdo->query(
        "SELECT COUNT(*) FROM `mss_inventory_records` WHERE `id` LIKE 'demo_medicine_%'"
    );
    $totalCountStatement = $pdo->query('SELECT COUNT(*) FROM `mss_inventory_records`');

    return [
        'seeded' => (int) $seededCountStatement->fetchColumn(),
        'total' => (int) $totalCountStatement->fetchColumn(),
    ];
}

try {
    $resetExisting = in_array('--reset', $argv ?? [], true);
    $result = mss_seed_demo_inventory(mss_db_connection(), $resetExisting);
    fwrite(
        STDOUT,
        sprintf(
            "Inventory ready: %d seeded records, %d total inventory records.%s",
            $result['seeded'],
            $result['total'],
            PHP_EOL
        )
    );
    exit($result['seeded'] === MSS_DEMO_INVENTORY_SIZE ? 0 : 1);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Unable to seed demo inventory: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
