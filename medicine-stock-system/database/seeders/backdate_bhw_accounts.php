<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/db.php';

$apply = in_array('--apply', $argv ?? [], true);
$pdo = mss_db_connection();
mss_ensure_schema($pdo);

$accountDates = [
    'Christine Pajalla' => '2026-01-05 08:35:00',
    'Dhan Abion' => '2026-01-07 09:10:00',
    'Marvin Negre' => '2026-01-09 10:20:00',
    'Ranie Ferrer' => '2026-01-12 14:05:00',
];

$findUser = $pdo->prepare(
    "SELECT `id`, `full_name`, `username`, `created_at`
     FROM `mss_users`
     WHERE `full_name` = :full_name AND LOWER(`role`) = 'bhw'
     LIMIT 1"
);
$countCreationLogs = $pdo->prepare(
    "SELECT COUNT(*)
     FROM `mss_activity_logs`
     WHERE LOWER(`action`) = 'created bhw account' AND `target` = :full_name"
);
$users = [];
foreach ($accountDates as $fullName => $createdAt) {
    $findUser->execute(['full_name' => $fullName]);
    $user = $findUser->fetch();
    if (!is_array($user)) {
        throw new RuntimeException("BHW account not found: {$fullName}");
    }
    $user['new_created_at'] = $createdAt;
    $countCreationLogs->execute(['full_name' => $fullName]);
    $user['creation_log_count'] = (int) $countCreationLogs->fetchColumn();
    $users[] = $user;
}

echo "BHW account creation dates:\n";
foreach ($users as $user) {
    echo "  {$user['full_name']}: {$user['created_at']} -> {$user['new_created_at']}"
        . " | creation logs: {$user['creation_log_count']}\n";
}

if (!$apply) {
    echo "Dry run only. Run again with --apply to update the database dates.\n";
    exit(0);
}

$updateUser = $pdo->prepare(
    "UPDATE `mss_users`
     SET `created_at` = :created_at
     WHERE `id` = :id AND LOWER(`role`) = 'bhw'"
);
$updateCreationLog = $pdo->prepare(
    "UPDATE `mss_activity_logs`
     SET `created_at` = :created_at
     WHERE LOWER(`action`) = 'created bhw account'
       AND `target` = :full_name"
);

$pdo->beginTransaction();
try {
    foreach ($users as $user) {
        $updateUser->execute([
            'id' => $user['id'],
            'created_at' => $user['new_created_at'],
        ]);
        $updateCreationLog->execute([
            'full_name' => $user['full_name'],
            'created_at' => $user['new_created_at'],
        ]);
    }
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $exception;
}

echo "Updated four BHW account creation dates and matching creation audit logs.\n";
