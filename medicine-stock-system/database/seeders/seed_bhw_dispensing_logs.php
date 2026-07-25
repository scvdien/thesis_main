<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/db.php';

$apply = in_array('--apply', $argv ?? [], true);
$pdo = mss_db_connection();
mss_ensure_schema($pdo);

$movements = $pdo->query(
    "SELECT m.`id`, m.`medicine_name`, m.`quantity`, m.`disease_category`,
            m.`illness`, m.`created_at`, m.`recipient_id`, m.`recipient_name`,
            m.`recipient_barangay`, m.`released_by_name`,
            COALESCE(NULLIF(i.`unit`, ''), 'unit(s)') AS `unit`,
            COALESCE(u.`username`, '') AS `username`,
            COALESCE((
                SELECT s.`ip_address`
                FROM `mss_sessions` s
                WHERE s.`user_id` = u.`id` AND s.`ip_address` <> ''
                ORDER BY s.`last_seen_at` DESC
                LIMIT 1
            ), '') AS `ip_address`
     FROM `mss_inventory_movements` m
     LEFT JOIN `mss_inventory_records` i ON i.`id` = m.`medicine_id`
     LEFT JOIN `mss_users` u
       ON u.`full_name` = m.`released_by_name` AND LOWER(u.`role`) = 'bhw'
     WHERE m.`id` LIKE 'demo5m-%' AND LOWER(m.`action_type`) = 'dispense'
     ORDER BY m.`created_at`, m.`id`"
)->fetchAll();

if ($movements === []) {
    throw new RuntimeException('No five-month BHW dispensing records were found.');
}

$bhwCounts = [];
foreach ($movements as $movement) {
    $bhw = (string) $movement['released_by_name'];
    $bhwCounts[$bhw] = ($bhwCounts[$bhw] ?? 0) + 1;
}

echo 'Dispensing logs to store: ' . count($movements) . "\n";
foreach ($bhwCounts as $bhw => $count) {
    echo "  {$bhw}: {$count} logs\n";
}

if (!$apply) {
    echo "Dry run only. Run again with --apply to save the activity logs.\n";
    exit(0);
}

$upsertLog = $pdo->prepare(
    'INSERT INTO `mss_activity_logs`
        (`id`, `actor`, `username`, `action`, `action_type`, `target`, `details`,
         `category`, `result_label`, `result_tone`, `ip_address`, `created_at`)
     VALUES
        (:id, :actor, :username, "Dispensed medicine", "updated", :target, :details,
         "Dispensing", "Dispensed", "success", :ip_address, :created_at)
     ON DUPLICATE KEY UPDATE
        `actor` = VALUES(`actor`),
        `username` = VALUES(`username`),
        `target` = VALUES(`target`),
        `details` = VALUES(`details`),
        `ip_address` = VALUES(`ip_address`),
        `created_at` = VALUES(`created_at`)'
);

$pdo->beginTransaction();
try {
    foreach ($movements as $movement) {
        $recipientLabel = trim((string) $movement['recipient_name']);
        $recipientId = trim((string) $movement['recipient_id']);
        if ($recipientId !== '') {
            $recipientLabel .= " ({$recipientId})";
        }
        $caseLabel = trim(implode(' | ', array_filter([
            (string) $movement['disease_category'],
            (string) $movement['illness'],
        ])));
        $details = sprintf(
            '%d %s %s dispensed to %s from %s. Case: %s. Dispensed by BHW: %s.',
            (int) $movement['quantity'],
            (string) $movement['unit'],
            (string) $movement['medicine_name'],
            $recipientLabel,
            (string) $movement['recipient_barangay'],
            $caseLabel !== '' ? $caseLabel : 'General consultation',
            (string) $movement['released_by_name']
        );

        $upsertLog->execute([
            'id' => 'dispense-log-' . $movement['id'],
            'actor' => $movement['released_by_name'],
            'username' => $movement['username'],
            'target' => $movement['medicine_name'],
            'details' => $details,
            'ip_address' => $movement['ip_address'],
            'created_at' => $movement['created_at'],
        ]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

$verify = $pdo->query(
    "SELECT COUNT(*) FROM `mss_activity_logs` WHERE `id` LIKE 'dispense-log-demo5m-%'"
);
echo 'Stored dispensing activity logs: ' . (int) $verify->fetchColumn() . "\n";
