<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

final class MSSStateValidationException extends RuntimeException
{
}

function mss_state_text(mixed $value): string
{
    return trim((string) ($value ?? ''));
}

function mss_state_online_window_seconds(): int
{
    return 1800;
}

function mss_state_int(mixed $value, int $default = 0, ?int $min = 0): int
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    $number = $parsed !== false ? (int) $parsed : $default;

    return $min === null ? $number : max($min, $number);
}

function mss_state_decimal(mixed $value, float $default = 0.0): string
{
    $number = is_numeric($value) ? (float) $value : $default;
    return number_format($number, 2, '.', '');
}

function mss_state_date(mixed $value, ?string $fallback = null): ?string
{
    $raw = mss_state_text($value);
    if ($raw === '') {
        return $fallback;
    }

    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return $fallback;
    }

    return date('Y-m-d', $timestamp);
}

function mss_state_datetime(mixed $value, ?string $fallback = null): string
{
    $raw = mss_state_text($value);
    if ($raw === '') {
        return $fallback ?? date('Y-m-d H:i:s');
    }

    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return $fallback ?? date('Y-m-d H:i:s');
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function mss_state_nullable_datetime(mixed $value): ?string
{
    $raw = mss_state_text($value);
    if ($raw === '') {
        return null;
    }

    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function mss_state_uid(string $prefix): string
{
    try {
        return $prefix . '_' . bin2hex(random_bytes(8));
    } catch (Throwable $exception) {
        return $prefix . '_' . uniqid('', true);
    }
}

function mss_state_has_collection(array $payload, string $key, array $aliases = []): bool
{
    if (array_key_exists($key, $payload)) {
        return is_array($payload[$key]);
    }

    foreach ($aliases as $alias) {
        if (array_key_exists($alias, $payload)) {
            return is_array($payload[$alias]);
        }
    }

    return false;
}

function mss_state_collection(array $payload, string $key, array $aliases = []): array
{
    if (array_key_exists($key, $payload) && is_array($payload[$key])) {
        return $payload[$key];
    }

    foreach ($aliases as $alias) {
        if (array_key_exists($alias, $payload) && is_array($payload[$alias])) {
            return $payload[$alias];
        }
    }

    return [];
}

function mss_state_json_encode(mixed $value, string $fallback = '[]'): string
{
    $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return $encoded !== false ? $encoded : $fallback;
}

function mss_state_json_decode_array(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function mss_state_inventory_identity_part(mixed $value): string
{
    $normalized = preg_replace('/\s+/', ' ', mss_state_text($value));
    return strtolower($normalized ?? '');
}

function mss_state_inventory_identity_key(array $row): string
{
    $form = mss_state_text($row['form'] ?? 'Tablet') ?: 'Tablet';

    return implode('|', [
        mss_state_inventory_identity_part($row['name'] ?? ''),
        mss_state_inventory_identity_part($form),
        mss_state_inventory_identity_part($row['strength'] ?? ''),
    ]);
}

function mss_state_inventory_identity_label(array $row): string
{
    $name = mss_state_text($row['name'] ?? 'Medicine') ?: 'Medicine';
    $strength = mss_state_text($row['strength'] ?? '');
    $form = mss_state_text($row['form'] ?? 'Tablet') ?: 'Tablet';
    $label = trim($name . ($strength !== '' ? ' ' . $strength : ''));

    return $label . ' (' . $form . ')';
}

function mss_state_inventory_record_status(mixed $value): string
{
    return strtolower(mss_state_text($value)) === 'archived' ? 'archived' : 'active';
}

function mss_state_request_record_status(mixed $value): string
{
    return strtolower(mss_state_text($value)) === 'archived' ? 'archived' : 'active';
}

function mss_state_assert_unique_inventory_records(array $rows): void
{
    $seen = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $name = mss_state_text($row['name'] ?? '');
        if ($name === '') {
            continue;
        }

        $identityKey = mss_state_inventory_identity_key($row);
        if (isset($seen[$identityKey])) {
            throw new MSSStateValidationException(
                mss_state_inventory_identity_label($row) . ' is already in the inventory. Update the existing record instead.'
            );
        }

        $seen[$identityKey] = true;
    }
}

/**
 * @return array<string, string>
 */
function mss_state_existing_password_hashes(PDO $pdo): array
{
    $map = [];
    $rows = $pdo->query('SELECT `id`, `username`, `password_hash` FROM `mss_users`')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $id = mss_state_text($row['id'] ?? '');
        $username = mss_state_text($row['username'] ?? '');
        $hash = mss_state_text($row['password_hash'] ?? '');
        if ($id !== '' && $hash !== '') {
            $map['id:' . $id] = $hash;
        }
        if ($username !== '' && $hash !== '') {
            $map['username:' . strtolower($username)] = $hash;
        }
    }

    return $map;
}

function mss_state_existing_password_hash(array $passwordHashes, string $id, string $username): string
{
    $byId = $passwordHashes['id:' . $id] ?? '';
    if ($byId !== '') {
        return $byId;
    }

    $byUsername = $passwordHashes['username:' . strtolower($username)] ?? '';
    return is_string($byUsername) ? $byUsername : '';
}

function mss_state_assert_password_changed(string $password, string $existingHash): void
{
    if ($password === '' || $existingHash === '') {
        return;
    }

    if (password_verify($password, $existingHash)) {
        throw new MSSStateValidationException('New password must be different from the current password.');
    }
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_users(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_users` ORDER BY `updated_at` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'fullName' => mss_state_text($row['full_name'] ?? ''),
            'username' => mss_state_text($row['username'] ?? ''),
            'contact' => mss_state_text($row['contact'] ?? ''),
            'accountType' => mss_state_text($row['account_type'] ?? ''),
            'role' => mss_state_text($row['role'] ?? ''),
            'status' => mss_state_text($row['status'] ?? 'Active'),
            'password' => '',
            'credentialsUpdatedAt' => mss_state_text($row['credentials_updated_at'] ?? ''),
            'createdAt' => str_replace(' ', 'T', mss_state_text($row['created_at'] ?? '')),
            'createdBy' => mss_state_text($row['created_by'] ?? ''),
            'updatedAt' => str_replace(' ', 'T', mss_state_text($row['updated_at'] ?? '')),
            'updatedBy' => mss_state_text($row['updated_by'] ?? ''),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_sessions(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_sessions` ORDER BY `last_seen_at` DESC')->fetchAll(PDO::FETCH_ASSOC);
    $latestByUser = [];

    foreach ($rows as $row) {
        $userId = mss_state_text($row['user_id'] ?? '');
        if ($userId === '' || isset($latestByUser[$userId])) {
            continue;
        }

        $lastSeenAt = mss_state_text($row['last_seen_at'] ?? '');
        $lastSeenTimestamp = $lastSeenAt !== '' ? strtotime($lastSeenAt) : false;
        $isOnline = $lastSeenTimestamp !== false && $lastSeenTimestamp >= (time() - mss_state_online_window_seconds());

        $latestByUser[$userId] = [
            'id' => (string) ($row['id'] ?? ''),
            'userId' => $userId,
            'fullName' => mss_state_text($row['full_name'] ?? ''),
            'username' => mss_state_text($row['username'] ?? ''),
            'role' => mss_state_text($row['role'] ?? ''),
            'accountType' => mss_state_text($row['account_type'] ?? ''),
            'presence' => $isOnline ? 'Online' : 'Offline',
            'location' => mss_state_text($row['location_label'] ?? ''),
            'deviceLabel' => mss_state_text($row['device_label'] ?? ''),
            'ipAddress' => mss_state_text($row['ip_address'] ?? ''),
            'signedInAt' => str_replace(' ', 'T', mss_state_text($row['signed_in_at'] ?? '')),
            'lastSeenAt' => str_replace(' ', 'T', $lastSeenAt),
        ];
    }

    return array_values($latestByUser);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_log_action_type(array $row): string
{
    $category = strtolower(mss_state_text($row['category'] ?? ''));
    $actionText = strtolower(trim(
        mss_state_text($row['action'] ?? '') . ' ' . mss_state_text($row['details'] ?? '')
    ));
    $explicitType = strtolower(mss_state_text($row['actionType'] ?? $row['action_type'] ?? $row['type'] ?? ''));

    if ($category === 'security' || preg_match('/password|credential|security/', $actionText) === 1) {
        return 'security';
    }
    if (preg_match('/created|added|provisioned|registered/', $actionText) === 1) {
        return 'created';
    }
    if (preg_match('/deleted|removed|archived|expired batch/', $actionText) === 1) {
        return 'deleted';
    }
    if ($category === 'access' || preg_match('/login|logout|activate|deactivate|access/', $actionText) === 1) {
        return 'access';
    }

    return in_array($explicitType, ['created', 'updated', 'deleted', 'security', 'access'], true)
        ? $explicitType
        : 'updated';
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_logs(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_activity_logs` ORDER BY `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'actor' => mss_state_text($row['actor'] ?? ''),
            'username' => mss_state_text($row['username'] ?? ''),
            'action' => mss_state_text($row['action'] ?? ''),
            'actionType' => mss_state_log_action_type($row),
            'target' => mss_state_text($row['target'] ?? ''),
            'details' => mss_state_text($row['details'] ?? ''),
            'category' => mss_state_text($row['category'] ?? ''),
            'resultLabel' => mss_state_text($row['result_label'] ?? ''),
            'resultTone' => mss_state_text($row['result_tone'] ?? ''),
            'ipAddress' => mss_state_text($row['ip_address'] ?? ''),
            'createdAt' => str_replace(' ', 'T', mss_state_text($row['created_at'] ?? '')),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_inventory(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_inventory_records` ORDER BY `last_updated_at` DESC, `name` ASC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'name' => mss_state_text($row['name'] ?? ''),
            'genericName' => mss_state_text($row['generic_name'] ?? ''),
            'category' => mss_state_text($row['category'] ?? ''),
            'form' => mss_state_text($row['form'] ?? ''),
            'strength' => mss_state_text($row['strength'] ?? ''),
            'stockOnHand' => mss_state_int($row['stock_on_hand'] ?? 0),
            'reorderLevel' => mss_state_int($row['reorder_level'] ?? 1, 1),
            'unit' => mss_state_text($row['unit'] ?? ''),
            'batchNumber' => mss_state_text($row['batch_number'] ?? ''),
            'expiryDate' => mss_state_text($row['expiry_date'] ?? ''),
            'recordStatus' => mss_state_inventory_record_status($row['record_status'] ?? 'active'),
            'unitCost' => (float) ($row['unit_cost'] ?? 0),
            'updatedBy' => mss_state_text($row['updated_by'] ?? ''),
            'lastUpdatedAt' => str_replace(' ', 'T', mss_state_text($row['last_updated_at'] ?? '')),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_movements(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_inventory_movements` ORDER BY `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'medicineId' => mss_state_text($row['medicine_id'] ?? ''),
            'medicineName' => mss_state_text($row['medicine_name'] ?? ''),
            'actionType' => mss_state_text($row['action_type'] ?? ''),
            'quantity' => mss_state_int($row['quantity'] ?? 0),
            'diseaseCategory' => mss_state_text($row['disease_category'] ?? ''),
            'illness' => mss_state_text($row['illness'] ?? ''),
            'note' => mss_state_text($row['note'] ?? ''),
            'stockBefore' => mss_state_int($row['stock_before'] ?? 0),
            'stockAfter' => mss_state_int($row['stock_after'] ?? 0),
            'createdAt' => str_replace(' ', 'T', mss_state_text($row['created_at'] ?? '')),
            'user' => mss_state_text($row['user_name'] ?? ''),
            'recipientId' => mss_state_text($row['recipient_id'] ?? ''),
            'recipientName' => mss_state_text($row['recipient_name'] ?? ''),
            'recipientBarangay' => mss_state_text($row['recipient_barangay'] ?? ''),
            'releasedByRole' => mss_state_text($row['released_by_role'] ?? ''),
            'releasedByName' => mss_state_text($row['released_by_name'] ?? ''),
            'linkedRequestId' => mss_state_text($row['linked_request_id'] ?? ''),
            'linkedRequestItemId' => mss_state_text($row['linked_request_item_id'] ?? ''),
            'linkedRequestGroupId' => mss_state_text($row['linked_request_group_id'] ?? ''),
            'linkedRequestCode' => mss_state_text($row['linked_request_code'] ?? ''),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_residents(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_resident_accounts` ORDER BY `full_name` ASC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'residentId' => mss_state_text($row['resident_id'] ?? ''),
            'householdId' => mss_state_text($row['household_id'] ?? ''),
            'fullName' => mss_state_text($row['full_name'] ?? ''),
            'barangay' => mss_state_text($row['barangay'] ?? ''),
            'zone' => mss_state_text($row['zone'] ?? ''),
            'city' => mss_state_text($row['city'] ?? ''),
            'province' => mss_state_text($row['province'] ?? ''),
            'address' => mss_state_text($row['address'] ?? ''),
            'source' => mss_state_text($row['source'] ?? ''),
            'lastDispensedAt' => mss_state_text($row['last_dispensed_at'] ?? ''),
            'lastDispensedMedicine' => mss_state_text($row['last_dispensed_medicine'] ?? ''),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_requests(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_cho_requests` ORDER BY `request_date` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'requestGroupId' => mss_state_text($row['request_group_id'] ?? ''),
            'requestCode' => mss_state_text($row['request_code'] ?? ''),
            'medicineId' => mss_state_text($row['medicine_id'] ?? ''),
            'medicineName' => mss_state_text($row['medicine_name'] ?? ''),
            'genericName' => mss_state_text($row['generic_name'] ?? ''),
            'strength' => mss_state_text($row['strength'] ?? ''),
            'unit' => mss_state_text($row['unit'] ?? ''),
            'quantityRequested' => mss_state_int($row['quantity_requested'] ?? 1, 1),
            'requestDate' => mss_state_text($row['request_date'] ?? ''),
            'expectedDate' => mss_state_text($row['expected_date'] ?? ''),
            'source' => mss_state_text($row['source'] ?? ''),
            'requestedBy' => mss_state_text($row['requested_by'] ?? ''),
            'notes' => mss_state_text($row['notes'] ?? ''),
            'recordStatus' => mss_state_request_record_status($row['record_status'] ?? 'active'),
            'createdAt' => str_replace(' ', 'T', mss_state_text($row['created_at'] ?? '')),
            'updatedAt' => str_replace(' ', 'T', mss_state_text($row['updated_at'] ?? '')),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_notifications(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_notifications` ORDER BY `created_at` DESC, `updated_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'category' => mss_state_text($row['category'] ?? ''),
            'priority' => mss_state_text($row['priority'] ?? 'medium'),
            'title' => mss_state_text($row['title'] ?? ''),
            'body' => mss_state_text($row['body'] ?? ''),
            'source' => mss_state_text($row['source'] ?? ''),
            'recommendation' => mss_state_text($row['recommendation'] ?? ''),
            'signature' => mss_state_text($row['signature'] ?? ''),
            // Read state is tracked per signed-in user through client-state storage.
            'read' => false,
            'createdAt' => str_replace(' ', 'T', mss_state_text($row['created_at'] ?? '')),
            'updatedAt' => str_replace(' ', 'T', mss_state_text($row['updated_at'] ?? '')),
        ];
    }, $rows);
}

/**
 * @return array<int, array<string, mixed>>
 */
function mss_state_fetch_report_history(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM `mss_report_history` ORDER BY `generated_at` DESC, `created_at` DESC')->fetchAll(PDO::FETCH_ASSOC);

    return array_map(static function (array $row): array {
        $definition = mss_state_json_decode_array($row['report_definition_json'] ?? '');
        $tableRows = mss_state_json_decode_array($row['table_rows_json'] ?? '');
        $columns = [];

        foreach (($definition['columns'] ?? []) as $column) {
            if (!is_array($column)) {
                continue;
            }

            $columns[] = [
                'label' => mss_state_text($column['label'] ?? 'Column') ?: 'Column',
            ];
        }

        return [
            'id' => mss_state_text($row['id'] ?? ''),
            'format' => mss_state_text($row['format'] ?? 'pdf'),
            'generatedAt' => str_replace(' ', 'T', mss_state_text($row['generated_at'] ?? '')),
            'preparedBy' => mss_state_text($row['prepared_by'] ?? ''),
            'rowCount' => mss_state_int($row['row_count'] ?? 0),
            'reportDefinition' => [
                'key' => mss_state_text($definition['key'] ?? $row['report_key'] ?? 'report') ?: 'report',
                'label' => mss_state_text($definition['label'] ?? $row['report_label'] ?? 'Report') ?: 'Report',
                'title' => mss_state_text($definition['title'] ?? $row['report_title'] ?? 'Generated Report') ?: 'Generated Report',
                'description' => mss_state_text($definition['description'] ?? $row['report_description'] ?? ''),
                'submission' => mss_state_text($definition['submission'] ?? $row['submission_label'] ?? ''),
                'dataSource' => mss_state_text($definition['dataSource'] ?? $row['data_source'] ?? ''),
                'recordSingular' => mss_state_text($definition['recordSingular'] ?? 'record') ?: 'record',
                'recordPlural' => mss_state_text($definition['recordPlural'] ?? 'records') ?: 'records',
                'columns' => $columns,
            ],
            'tableRows' => array_map(
                static fn (mixed $tableRow): array => is_array($tableRow) ? array_map('strval', $tableRow) : [],
                is_array($tableRows) ? $tableRows : []
            ),
        ];
    }, $rows);
}

function mss_state_client_state_scope(PDO $pdo): string
{
    static $resolvedScope = null;
    if (is_string($resolvedScope) && $resolvedScope !== '') {
        return $resolvedScope;
    }

    $user = mss_auth_current_user($pdo);
    if (is_array($user)) {
        $userId = mss_state_text($user['id'] ?? '');
        if ($userId !== '') {
            $resolvedScope = 'user:' . $userId;
            return $resolvedScope;
        }

        $username = strtolower(mss_state_text($user['username'] ?? ''));
        if ($username !== '') {
            $resolvedScope = 'username:' . $username;
            return $resolvedScope;
        }

        $role = mss_auth_user_role($user);
        if ($role !== '') {
            $resolvedScope = 'role:' . $role;
            return $resolvedScope;
        }
    }

    $resolvedScope = 'global';
    return $resolvedScope;
}

function mss_state_client_state_storage_key(PDO $pdo, string $key, bool $scoped = false): string
{
    $baseKey = mss_state_text($key);
    if ($baseKey === '' || !$scoped) {
        return $baseKey;
    }

    return $baseKey . '::' . mss_state_client_state_scope($pdo);
}

function mss_state_fetch_client_state_value_by_storage_key(PDO $pdo, string $storageKey): ?array
{
    $normalizedKey = mss_state_text($storageKey);
    if ($normalizedKey === '') {
        return null;
    }

    $stmt = $pdo->prepare('SELECT `state_json` FROM `mss_client_state` WHERE `state_key` = :state_key LIMIT 1');
    $stmt->execute([
        ':state_key' => $normalizedKey,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }

    return mss_state_json_decode_array($row['state_json'] ?? '');
}

/**
 * @return array<string, array<mixed>>
 */
function mss_state_fetch_client_state_values(PDO $pdo, string $key, bool $includeScoped = false): array
{
    $normalizedKey = mss_state_text($key);
    if ($normalizedKey === '') {
        return [];
    }

    if ($includeScoped) {
        $stmt = $pdo->prepare(
            'SELECT `state_key`, `state_json`
             FROM `mss_client_state`
             WHERE `state_key` = :state_key OR `state_key` LIKE :state_prefix'
        );
        $stmt->execute([
            ':state_key' => $normalizedKey,
            ':state_prefix' => $normalizedKey . '::%',
        ]);
    } else {
        $stmt = $pdo->prepare(
            'SELECT `state_key`, `state_json`
             FROM `mss_client_state`
             WHERE `state_key` = :state_key'
        );
        $stmt->execute([
            ':state_key' => $normalizedKey,
        ]);
    }

    $values = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $storageKey = mss_state_text($row['state_key'] ?? '');
        if ($storageKey === '') {
            continue;
        }

        $values[$storageKey] = mss_state_json_decode_array($row['state_json'] ?? '');
    }

    return $values;
}

function mss_state_fetch_client_state_value(
    PDO $pdo,
    string $key,
    array $default = [],
    bool $scoped = false,
    bool $fallbackToLegacy = false
): array {
    $storageKeys = [];
    if ($scoped) {
        $storageKeys[] = mss_state_client_state_storage_key($pdo, $key, true);
        if ($fallbackToLegacy) {
            $storageKeys[] = mss_state_client_state_storage_key($pdo, $key, false);
        }
    } else {
        $storageKeys[] = mss_state_client_state_storage_key($pdo, $key, false);
    }

    foreach (array_values(array_unique(array_filter($storageKeys))) as $storageKey) {
        $decoded = mss_state_fetch_client_state_value_by_storage_key($pdo, $storageKey);
        if ($decoded !== null) {
            return $decoded;
        }
    }

    return $default;
}

function mss_state_fetch_notification_preferences(PDO $pdo): array
{
    $stored = mss_state_fetch_client_state_value($pdo, 'notification_preferences', [], true, true);
    $soundEnabled = filter_var($stored['soundEnabled'] ?? true, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
    $browserAlertsEnabled = filter_var($stored['browserAlertsEnabled'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

    return [
        'soundEnabled' => $soundEnabled === null ? true : $soundEnabled,
        'browserAlertsEnabled' => $browserAlertsEnabled === null ? false : $browserAlertsEnabled,
    ];
}

function mss_state_fetch_notification_popup_state(PDO $pdo): array
{
    $stored = mss_state_fetch_client_state_value($pdo, 'notification_popup_state', [], true);
    $popupState = [];

    foreach ($stored as $key => $value) {
        $signature = mss_state_text($value);
        $stateKey = mss_state_text($key);
        if ($stateKey === '' || $signature === '') {
            continue;
        }

        $popupState[$stateKey] = $signature;
    }

    return $popupState;
}

function mss_state_fetch_notification_dismissed_state(PDO $pdo): array
{
    $stored = mss_state_fetch_client_state_value($pdo, 'notification_dismissed_state', [], true);
    $dismissedState = [];

    foreach ($stored as $key => $value) {
        $signature = mss_state_text($value);
        $stateKey = mss_state_text($key);
        if ($stateKey === '' || $signature === '') {
            continue;
        }

        $dismissedState[$stateKey] = $signature;
    }

    return $dismissedState;
}

function mss_state_fetch_notification_read_state(PDO $pdo): array
{
    $stored = mss_state_fetch_client_state_value($pdo, 'notification_read_state', [], true);
    $readState = [];

    foreach ($stored as $key => $value) {
        $signature = mss_state_text($value);
        $stateKey = mss_state_text($key);
        if ($stateKey === '' || $signature === '') {
            continue;
        }

        $readState[$stateKey] = $signature;
    }

    return $readState;
}

function mss_state_fetch_notification_resolved_state(PDO $pdo): array
{
    $stored = mss_state_fetch_client_state_value($pdo, 'notification_resolved_state');
    $resolvedState = [];

    foreach ($stored as $key => $value) {
        $stateKey = mss_state_text($key);
        $entry = is_array($value) ? $value : [];
        $signature = mss_state_text($entry['signature'] ?? $value);
        if ($stateKey === '' || $signature === '') {
            continue;
        }

        $resolvedAt = mss_state_text($entry['resolvedAt'] ?? $entry['resolved_at'] ?? '');
        $isRead = filter_var($entry['read'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        $resolvedState[$stateKey] = [
            'signature' => $signature,
            'resolvedAt' => $resolvedAt !== ''
                ? str_replace(' ', 'T', mss_state_datetime($resolvedAt))
                : '',
            'read' => $isRead === null ? false : $isRead,
        ];
    }

    return $resolvedState;
}

function mss_state_notification_retention_days(): int
{
    return 90;
}

function mss_state_purge_expired_resolved_notifications(PDO $pdo, ?int $retentionDays = null): void
{
    $retentionDays = max(1, (int) ($retentionDays ?? mss_state_notification_retention_days()));
    $resolvedState = mss_state_fetch_notification_resolved_state($pdo);
    if ($resolvedState === []) {
        return;
    }

    $cutoffTimestamp = time() - ($retentionDays * 86400);
    $notificationIdsToPurge = [];

    foreach ($resolvedState as $notificationId => $entry) {
        $resolvedAt = mss_state_text($entry['resolvedAt'] ?? $entry['resolved_at'] ?? '');
        if ($resolvedAt === '') {
            continue;
        }

        $resolvedTimestamp = strtotime(str_replace('T', ' ', $resolvedAt));
        if ($resolvedTimestamp === false || $resolvedTimestamp > $cutoffTimestamp) {
            continue;
        }

        $normalizedId = mss_state_text($notificationId);
        if ($normalizedId === '') {
            continue;
        }

        $notificationIdsToPurge[] = $normalizedId;
    }

    $notificationIdsToPurge = array_values(array_unique($notificationIdsToPurge));
    if ($notificationIdsToPurge === []) {
        return;
    }

    $placeholders = implode(', ', array_fill(0, count($notificationIdsToPurge), '?'));
    $deleteStmt = $pdo->prepare("DELETE FROM `mss_notifications` WHERE `id` IN ({$placeholders})");
    $deleteStmt->execute($notificationIdsToPurge);

    foreach ($notificationIdsToPurge as $notificationId) {
        unset($resolvedState[$notificationId]);
    }

    foreach (['notification_popup_state', 'notification_dismissed_state', 'notification_read_state'] as $stateKey) {
        $storedValues = mss_state_fetch_client_state_values($pdo, $stateKey, true);
        foreach ($storedValues as $storageKey => $storedValue) {
            $nextValue = is_array($storedValue) ? $storedValue : [];
            foreach ($notificationIdsToPurge as $notificationId) {
                unset($nextValue[$notificationId]);
            }
            mss_state_replace_client_state_value_by_storage_key($pdo, $storageKey, $nextValue);
        }
    }

    mss_state_replace_notification_resolved_state($pdo, $resolvedState);
}

function mss_state_replace_users(PDO $pdo, array $rows): void
{
    $passwordHashes = mss_state_existing_password_hashes($pdo);
    $pdo->exec('DELETE FROM `mss_users`');

    if ($rows === []) {
        mss_auth_seed_initial_admin($pdo);
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_users`
            (`id`, `full_name`, `username`, `contact`, `account_type`, `role`, `status`, `password_hash`, `credentials_updated_at`, `created_at`, `created_by`, `updated_at`, `updated_by`)
         VALUES
            (:id, :full_name, :username, :contact, :account_type, :role, :status, :password_hash, :credentials_updated_at, :created_at, :created_by, :updated_at, :updated_by)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $id = mss_state_text($row['id'] ?? '') ?: mss_state_uid('user');
        $username = mss_state_text($row['username'] ?? '');
        if ($username === '') {
            continue;
        }

        $password = (string) ($row['password'] ?? '');
        $existingPasswordHash = mss_state_existing_password_hash($passwordHashes, $id, $username);
        mss_state_assert_password_changed($password, $existingPasswordHash);
        $passwordHash = $password !== ''
            ? password_hash($password, PASSWORD_DEFAULT)
            : ($existingPasswordHash !== '' ? $existingPasswordHash : password_hash('Admin123!', PASSWORD_DEFAULT));

        $createdAt = mss_state_datetime($row['createdAt'] ?? '', date('Y-m-d H:i:s'));
        $updatedAt = mss_state_datetime($row['updatedAt'] ?? '', $createdAt);

        $stmt->execute([
            ':id' => $id,
            ':full_name' => mss_state_text($row['fullName'] ?? ''),
            ':username' => $username,
            ':contact' => mss_state_text($row['contact'] ?? ''),
            ':account_type' => mss_state_text($row['accountType'] ?? $row['role'] ?? 'BHW') ?: 'BHW',
            ':role' => mss_state_text($row['role'] ?? $row['accountType'] ?? 'BHW') ?: 'BHW',
            ':status' => mss_state_text($row['status'] ?? 'Active') ?: 'Active',
            ':password_hash' => $passwordHash,
            ':credentials_updated_at' => mss_state_nullable_datetime($row['credentialsUpdatedAt'] ?? ''),
            ':created_at' => $createdAt,
            ':created_by' => mss_state_text($row['createdBy'] ?? 'System Seed'),
            ':updated_at' => $updatedAt,
            ':updated_by' => mss_state_text($row['updatedBy'] ?? 'System Seed'),
        ]);
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM `mss_users`')->fetchColumn();
    if ($count === 0) {
        mss_auth_seed_initial_admin($pdo);
    }

    $pdo->exec(
        'DELETE `mss_sessions`
         FROM `mss_sessions`
         LEFT JOIN `mss_users` ON `mss_users`.`id` = `mss_sessions`.`user_id`
         WHERE `mss_users`.`id` IS NULL
            OR `mss_users`.`status` <> \'Active\''
    );
}

function mss_state_replace_sessions(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_sessions`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_sessions`
            (`session_token`, `user_id`, `full_name`, `username`, `role`, `account_type`, `presence`, `location_label`, `device_label`, `ip_address`, `signed_in_at`, `last_seen_at`, `created_at`, `updated_at`)
         VALUES
            (:session_token, :user_id, :full_name, :username, :role, :account_type, :presence, :location_label, :device_label, :ip_address, :signed_in_at, :last_seen_at, :created_at, :updated_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $token = mss_state_text($row['sessionToken'] ?? '');
        if ($token === '') {
            $token = 'snapshot_' . mss_state_uid('session');
        }

        $signedInAt = mss_state_datetime($row['signedInAt'] ?? '', date('Y-m-d H:i:s'));
        $lastSeenAt = mss_state_datetime($row['lastSeenAt'] ?? '', $signedInAt);

        $stmt->execute([
            ':session_token' => $token,
            ':user_id' => mss_state_text($row['userId'] ?? ''),
            ':full_name' => mss_state_text($row['fullName'] ?? ''),
            ':username' => mss_state_text($row['username'] ?? ''),
            ':role' => mss_state_text($row['role'] ?? ''),
            ':account_type' => mss_state_text($row['accountType'] ?? ''),
            ':presence' => mss_state_text($row['presence'] ?? 'Online') ?: 'Online',
            ':location_label' => mss_state_text($row['location'] ?? ''),
            ':device_label' => mss_state_text($row['deviceLabel'] ?? ''),
            ':ip_address' => mss_state_text($row['ipAddress'] ?? ''),
            ':signed_in_at' => $signedInAt,
            ':last_seen_at' => $lastSeenAt,
            ':created_at' => $signedInAt,
            ':updated_at' => $lastSeenAt,
        ]);
    }
}

function mss_state_replace_logs(PDO $pdo, array $rows): void
{
    $mergedRows = [];
    $seen = [];

    foreach (array_merge($rows, mss_state_fetch_logs($pdo)) as $row) {
        if (!is_array($row)) {
            continue;
        }

        $id = mss_state_text($row['id'] ?? '');
        if ($id === '') {
            $id = mss_state_uid('log');
            $row['id'] = $id;
        }

        if (isset($seen[$id])) {
            continue;
        }

        $seen[$id] = true;
        $mergedRows[] = $row;
    }

    usort($mergedRows, static function (array $left, array $right): int {
        $leftTimestamp = strtotime((string) ($left['createdAt'] ?? $left['created_at'] ?? '')) ?: 0;
        $rightTimestamp = strtotime((string) ($right['createdAt'] ?? $right['created_at'] ?? '')) ?: 0;
        return $rightTimestamp <=> $leftTimestamp;
    });

    $rows = array_slice($mergedRows, 0, 250);

    $pdo->exec('DELETE FROM `mss_activity_logs`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_activity_logs`
            (`id`, `actor`, `username`, `action`, `action_type`, `target`, `details`, `category`, `result_label`, `result_tone`, `ip_address`, `created_at`)
         VALUES
            (:id, :actor, :username, :action, :action_type, :target, :details, :category, :result_label, :result_tone, :ip_address, :created_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('log'),
            ':actor' => mss_state_text($row['actor'] ?? ''),
            ':username' => mss_state_text($row['username'] ?? ''),
            ':action' => mss_state_text($row['action'] ?? ''),
            ':action_type' => mss_state_log_action_type($row),
            ':target' => mss_state_text($row['target'] ?? ''),
            ':details' => mss_state_text($row['details'] ?? ''),
            ':category' => mss_state_text($row['category'] ?? 'General') ?: 'General',
            ':result_label' => mss_state_text($row['resultLabel'] ?? $row['result_label'] ?? 'Success') ?: 'Success',
            ':result_tone' => mss_state_text($row['resultTone'] ?? $row['result_tone'] ?? 'success') ?: 'success',
            ':ip_address' => mss_state_text($row['ipAddress'] ?? $row['ip_address'] ?? ''),
            ':created_at' => mss_state_datetime($row['createdAt'] ?? $row['created_at'] ?? '', date('Y-m-d H:i:s')),
        ]);
    }
}

function mss_state_replace_inventory(PDO $pdo, array $rows): void
{
    mss_state_assert_unique_inventory_records($rows);
    $pdo->exec('DELETE FROM `mss_inventory_records`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_inventory_records`
            (`id`, `name`, `generic_name`, `category`, `form`, `strength`, `stock_on_hand`, `reorder_level`, `unit`, `batch_number`, `expiry_date`, `unit_cost`, `record_status`, `updated_by`, `last_updated_at`)
         VALUES
            (:id, :name, :generic_name, :category, :form, :strength, :stock_on_hand, :reorder_level, :unit, :batch_number, :expiry_date, :unit_cost, :record_status, :updated_by, :last_updated_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('medicine'),
            ':name' => mss_state_text($row['name'] ?? ''),
            ':generic_name' => mss_state_text($row['genericName'] ?? $row['generic_name'] ?? ''),
            ':category' => mss_state_text($row['category'] ?? 'Others') ?: 'Others',
            ':form' => mss_state_text($row['form'] ?? 'Tablet') ?: 'Tablet',
            ':strength' => mss_state_text($row['strength'] ?? ''),
            ':stock_on_hand' => mss_state_int($row['stockOnHand'] ?? $row['stock_on_hand'] ?? 0),
            ':reorder_level' => mss_state_int($row['reorderLevel'] ?? $row['reorder_level'] ?? 1, 1),
            ':unit' => mss_state_text($row['unit'] ?? 'units') ?: 'units',
            ':batch_number' => mss_state_text($row['batchNumber'] ?? $row['batch_number'] ?? '-') ?: '-',
            ':expiry_date' => mss_state_date($row['expiryDate'] ?? $row['expiry_date'] ?? '', null),
            ':unit_cost' => mss_state_decimal($row['unitCost'] ?? $row['unit_cost'] ?? 0),
            ':record_status' => mss_state_inventory_record_status($row['recordStatus'] ?? $row['record_status'] ?? 'active'),
            ':updated_by' => mss_state_text($row['updatedBy'] ?? $row['updated_by'] ?? 'Nurse-in-Charge') ?: 'Nurse-in-Charge',
            ':last_updated_at' => mss_state_datetime($row['lastUpdatedAt'] ?? $row['last_updated_at'] ?? '', date('Y-m-d H:i:s')),
        ]);
    }
}

function mss_state_replace_movements(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_inventory_movements`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_inventory_movements`
            (`id`, `medicine_id`, `medicine_name`, `action_type`, `quantity`, `disease_category`, `illness`, `note`, `stock_before`, `stock_after`, `created_at`, `user_name`, `recipient_id`, `recipient_name`, `recipient_barangay`, `released_by_role`, `released_by_name`, `linked_request_id`, `linked_request_item_id`, `linked_request_group_id`, `linked_request_code`)
         VALUES
            (:id, :medicine_id, :medicine_name, :action_type, :quantity, :disease_category, :illness, :note, :stock_before, :stock_after, :created_at, :user_name, :recipient_id, :recipient_name, :recipient_barangay, :released_by_role, :released_by_name, :linked_request_id, :linked_request_item_id, :linked_request_group_id, :linked_request_code)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('movement'),
            ':medicine_id' => mss_state_text($row['medicineId'] ?? $row['medicine_id'] ?? ''),
            ':medicine_name' => mss_state_text($row['medicineName'] ?? $row['medicine_name'] ?? ''),
            ':action_type' => strtolower(mss_state_text($row['actionType'] ?? $row['action_type'] ?? 'adjusted') ?: 'adjusted'),
            ':quantity' => mss_state_int($row['quantity'] ?? 0),
            ':disease_category' => mss_state_text($row['diseaseCategory'] ?? $row['disease_category'] ?? ''),
            ':illness' => mss_state_text($row['illness'] ?? ''),
            ':note' => mss_state_text($row['note'] ?? ''),
            ':stock_before' => mss_state_int($row['stockBefore'] ?? $row['stock_before'] ?? 0),
            ':stock_after' => mss_state_int($row['stockAfter'] ?? $row['stock_after'] ?? 0),
            ':created_at' => mss_state_datetime($row['createdAt'] ?? $row['created_at'] ?? '', date('Y-m-d H:i:s')),
            ':user_name' => mss_state_text($row['user'] ?? $row['user_name'] ?? ''),
            ':recipient_id' => mss_state_text($row['recipientId'] ?? $row['recipient_id'] ?? ''),
            ':recipient_name' => mss_state_text($row['recipientName'] ?? $row['recipient_name'] ?? ''),
            ':recipient_barangay' => mss_state_text($row['recipientBarangay'] ?? $row['recipient_barangay'] ?? ''),
            ':released_by_role' => mss_state_text($row['releasedByRole'] ?? $row['released_by_role'] ?? ''),
            ':released_by_name' => mss_state_text($row['releasedByName'] ?? $row['released_by_name'] ?? ''),
            ':linked_request_id' => mss_state_text($row['linkedRequestId'] ?? $row['linked_request_id'] ?? ''),
            ':linked_request_item_id' => mss_state_text($row['linkedRequestItemId'] ?? $row['linked_request_item_id'] ?? ''),
            ':linked_request_group_id' => mss_state_text($row['linkedRequestGroupId'] ?? $row['linked_request_group_id'] ?? ''),
            ':linked_request_code' => mss_state_text($row['linkedRequestCode'] ?? $row['linked_request_code'] ?? ''),
        ]);
    }
}

function mss_state_replace_residents(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_resident_accounts`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_resident_accounts`
            (`id`, `resident_id`, `household_id`, `full_name`, `barangay`, `zone`, `city`, `province`, `address`, `source`, `last_dispensed_at`, `last_dispensed_medicine`)
         VALUES
            (:id, :resident_id, :household_id, :full_name, :barangay, :zone, :city, :province, :address, :source, :last_dispensed_at, :last_dispensed_medicine)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('resident'),
            ':resident_id' => mss_state_text($row['residentId'] ?? $row['resident_id'] ?? ''),
            ':household_id' => mss_state_text($row['householdId'] ?? $row['household_id'] ?? ''),
            ':full_name' => mss_state_text($row['fullName'] ?? $row['full_name'] ?? ''),
            ':barangay' => mss_state_text($row['barangay'] ?? 'Cabarian') ?: 'Cabarian',
            ':zone' => mss_state_text($row['zone'] ?? ''),
            ':city' => mss_state_text($row['city'] ?? 'Ligao City') ?: 'Ligao City',
            ':province' => mss_state_text($row['province'] ?? 'Albay') ?: 'Albay',
            ':address' => mss_state_text($row['address'] ?? ''),
            ':source' => mss_state_text($row['source'] ?? 'medicine-system') ?: 'medicine-system',
            ':last_dispensed_at' => mss_state_nullable_datetime($row['lastDispensedAt'] ?? $row['last_dispensed_at'] ?? ''),
            ':last_dispensed_medicine' => mss_state_text($row['lastDispensedMedicine'] ?? $row['last_dispensed_medicine'] ?? ''),
        ]);
    }
}

function mss_state_replace_requests(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_cho_requests`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_cho_requests`
            (`id`, `request_group_id`, `request_code`, `medicine_id`, `medicine_name`, `generic_name`, `strength`, `unit`, `quantity_requested`, `request_date`, `expected_date`, `source`, `requested_by`, `notes`, `record_status`, `created_at`, `updated_at`)
         VALUES
            (:id, :request_group_id, :request_code, :medicine_id, :medicine_name, :generic_name, :strength, :unit, :quantity_requested, :request_date, :expected_date, :source, :requested_by, :notes, :record_status, :created_at, :updated_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $requestDate = mss_state_date($row['requestDate'] ?? $row['request_date'] ?? '', date('Y-m-d'));
        $createdAt = mss_state_datetime($row['createdAt'] ?? $row['created_at'] ?? '', date('Y-m-d H:i:s'));

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('request'),
            ':request_group_id' => mss_state_text($row['requestGroupId'] ?? $row['request_group_id'] ?? '') ?: mss_state_uid('request_group'),
            ':request_code' => mss_state_text($row['requestCode'] ?? $row['request_code'] ?? ''),
            ':medicine_id' => mss_state_text($row['medicineId'] ?? $row['medicine_id'] ?? ''),
            ':medicine_name' => mss_state_text($row['medicineName'] ?? $row['medicine_name'] ?? ''),
            ':generic_name' => mss_state_text($row['genericName'] ?? $row['generic_name'] ?? ''),
            ':strength' => mss_state_text($row['strength'] ?? ''),
            ':unit' => mss_state_text($row['unit'] ?? 'units') ?: 'units',
            ':quantity_requested' => mss_state_int($row['quantityRequested'] ?? $row['quantity_requested'] ?? 1, 1),
            ':request_date' => $requestDate,
            ':expected_date' => mss_state_date($row['expectedDate'] ?? $row['expected_date'] ?? '', $requestDate) ?? $requestDate,
            ':source' => mss_state_text($row['source'] ?? 'City Health Office (CHO)') ?: 'City Health Office (CHO)',
            ':requested_by' => mss_state_text($row['requestedBy'] ?? $row['requested_by'] ?? 'Nurse-in-Charge') ?: 'Nurse-in-Charge',
            ':notes' => mss_state_text($row['notes'] ?? ''),
            ':record_status' => mss_state_request_record_status($row['recordStatus'] ?? $row['record_status'] ?? 'active'),
            ':created_at' => $createdAt,
            ':updated_at' => mss_state_datetime($row['updatedAt'] ?? $row['updated_at'] ?? '', $createdAt),
        ]);
    }
}

function mss_state_replace_notifications(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_notifications`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_notifications`
            (`id`, `category`, `priority`, `title`, `body`, `source`, `recommendation`, `signature`, `is_read`, `created_at`, `updated_at`)
         VALUES
            (:id, :category, :priority, :title, :body, :source, :recommendation, :signature, :is_read, :created_at, :updated_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $createdAt = mss_state_datetime($row['createdAt'] ?? $row['created_at'] ?? '', date('Y-m-d H:i:s'));

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('notification'),
            ':category' => mss_state_text($row['category'] ?? 'Medicine Status') ?: 'Medicine Status',
            ':priority' => mss_state_text($row['priority'] ?? 'medium') ?: 'medium',
            ':title' => mss_state_text($row['title'] ?? 'Medicine alert') ?: 'Medicine alert',
            ':body' => mss_state_text($row['body'] ?? 'Review the medicine notification.') ?: 'Review the medicine notification.',
            ':source' => mss_state_text($row['source'] ?? 'Inventory Analytics') ?: 'Inventory Analytics',
            ':recommendation' => mss_state_text($row['recommendation'] ?? 'Review the medicine notification.') ?: 'Review the medicine notification.',
            ':signature' => mss_state_text($row['signature'] ?? ''),
            // Persist shared notification records only. Per-user read state is stored separately.
            ':is_read' => 0,
            ':created_at' => $createdAt,
            ':updated_at' => mss_state_datetime($row['updatedAt'] ?? $row['updated_at'] ?? '', $createdAt),
        ]);
    }
}

function mss_state_replace_report_history(PDO $pdo, array $rows): void
{
    $pdo->exec('DELETE FROM `mss_report_history`');

    if ($rows === []) {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_report_history`
            (`id`, `format`, `report_key`, `report_label`, `report_title`, `report_description`, `submission_label`, `data_source`, `prepared_by`, `row_count`, `generated_at`, `report_definition_json`, `table_rows_json`, `created_at`, `updated_at`)
         VALUES
            (:id, :format, :report_key, :report_label, :report_title, :report_description, :submission_label, :data_source, :prepared_by, :row_count, :generated_at, :report_definition_json, :table_rows_json, :created_at, :updated_at)'
    );

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $definition = is_array($row['reportDefinition'] ?? null)
            ? $row['reportDefinition']
            : (is_array($row['report_definition'] ?? null) ? $row['report_definition'] : []);
        $tableRows = is_array($row['tableRows'] ?? null)
            ? $row['tableRows']
            : (is_array($row['table_rows'] ?? null) ? $row['table_rows'] : []);
        $generatedAt = mss_state_datetime($row['generatedAt'] ?? $row['generated_at'] ?? '', date('Y-m-d H:i:s'));

        $stmt->execute([
            ':id' => mss_state_text($row['id'] ?? '') ?: mss_state_uid('report'),
            ':format' => mss_state_text($row['format'] ?? 'pdf') ?: 'pdf',
            ':report_key' => mss_state_text($definition['key'] ?? $row['reportKey'] ?? $row['report_key'] ?? 'report') ?: 'report',
            ':report_label' => mss_state_text($definition['label'] ?? $row['reportLabel'] ?? $row['report_label'] ?? 'Report') ?: 'Report',
            ':report_title' => mss_state_text($definition['title'] ?? $row['reportTitle'] ?? $row['report_title'] ?? 'Generated Report') ?: 'Generated Report',
            ':report_description' => mss_state_text($definition['description'] ?? $row['reportDescription'] ?? $row['report_description'] ?? ''),
            ':submission_label' => mss_state_text($definition['submission'] ?? $row['submissionLabel'] ?? $row['submission_label'] ?? ''),
            ':data_source' => mss_state_text($definition['dataSource'] ?? $row['dataSource'] ?? $row['data_source'] ?? ''),
            ':prepared_by' => mss_state_text($row['preparedBy'] ?? $row['prepared_by'] ?? ''),
            ':row_count' => mss_state_int($row['rowCount'] ?? $row['row_count'] ?? count($tableRows)),
            ':generated_at' => $generatedAt,
            ':report_definition_json' => mss_state_json_encode($definition, '{}'),
            ':table_rows_json' => mss_state_json_encode($tableRows, '[]'),
            ':created_at' => mss_state_datetime($row['createdAt'] ?? $row['created_at'] ?? '', $generatedAt),
            ':updated_at' => mss_state_datetime($row['updatedAt'] ?? $row['updated_at'] ?? '', $generatedAt),
        ]);
    }
}

function mss_state_replace_client_state_value_by_storage_key(PDO $pdo, string $storageKey, array $value): void
{
    $normalizedKey = mss_state_text($storageKey);
    if ($normalizedKey === '') {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `mss_client_state` (`state_key`, `state_json`, `updated_at`)
         VALUES (:state_key, :state_json, :updated_at)
         ON DUPLICATE KEY UPDATE
            `state_json` = VALUES(`state_json`),
            `updated_at` = VALUES(`updated_at`)'
    );

    $stmt->execute([
        ':state_key' => $normalizedKey,
        ':state_json' => mss_state_json_encode($value, '{}'),
        ':updated_at' => date('Y-m-d H:i:s'),
    ]);
}

function mss_state_replace_client_state_value(PDO $pdo, string $key, array $value, bool $scoped = false): void
{
    mss_state_replace_client_state_value_by_storage_key(
        $pdo,
        mss_state_client_state_storage_key($pdo, $key, $scoped),
        $value
    );
}

function mss_state_replace_notification_preferences(PDO $pdo, array $value): void
{
    $soundEnabled = filter_var($value['soundEnabled'] ?? true, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
    $browserAlertsEnabled = filter_var($value['browserAlertsEnabled'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);

    mss_state_replace_client_state_value($pdo, 'notification_preferences', [
        'soundEnabled' => $soundEnabled === null ? true : $soundEnabled,
        'browserAlertsEnabled' => $browserAlertsEnabled === null ? false : $browserAlertsEnabled,
    ], true);
}

function mss_state_replace_notification_popup_state(PDO $pdo, array $value): void
{
    $popupState = [];

    foreach ($value as $key => $signature) {
        $stateKey = mss_state_text($key);
        $stateSignature = mss_state_text($signature);
        if ($stateKey === '' || $stateSignature === '') {
            continue;
        }

        $popupState[$stateKey] = $stateSignature;
    }

    mss_state_replace_client_state_value($pdo, 'notification_popup_state', $popupState, true);
}

function mss_state_replace_notification_dismissed_state(PDO $pdo, array $value): void
{
    $dismissedState = [];

    foreach ($value as $key => $signature) {
        $stateKey = mss_state_text($key);
        $stateSignature = mss_state_text($signature);
        if ($stateKey === '' || $stateSignature === '') {
            continue;
        }

        $dismissedState[$stateKey] = $stateSignature;
    }

    mss_state_replace_client_state_value($pdo, 'notification_dismissed_state', $dismissedState, true);
}

function mss_state_replace_notification_read_state(PDO $pdo, array $value): void
{
    $readState = [];

    foreach ($value as $key => $signature) {
        $stateKey = mss_state_text($key);
        $stateSignature = mss_state_text($signature);
        if ($stateKey === '' || $stateSignature === '') {
            continue;
        }

        $readState[$stateKey] = $stateSignature;
    }

    mss_state_replace_client_state_value($pdo, 'notification_read_state', $readState, true);
}

function mss_state_replace_notification_resolved_state(PDO $pdo, array $value): void
{
    $resolvedState = [];

    foreach ($value as $key => $entry) {
        $stateKey = mss_state_text($key);
        $stateEntry = is_array($entry) ? $entry : [];
        $signature = mss_state_text($stateEntry['signature'] ?? $entry);
        if ($stateKey === '' || $signature === '') {
            continue;
        }

        $resolvedAt = mss_state_text($stateEntry['resolvedAt'] ?? $stateEntry['resolved_at'] ?? '');
        $isRead = filter_var($stateEntry['read'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        $resolvedState[$stateKey] = [
            'signature' => $signature,
            'resolvedAt' => str_replace(
                ' ',
                'T',
                mss_state_datetime($resolvedAt, date('Y-m-d H:i:s'))
            ),
            'read' => $isRead === null ? false : $isRead,
        ];
    }

    mss_state_replace_client_state_value($pdo, 'notification_resolved_state', $resolvedState);
}

$pdo = mss_api_bootstrap(true);
$method = mss_api_request_method();
$scope = strtolower(trim((string) ($_GET['scope'] ?? '')));

if ($method === 'GET') {
    if ($scope === 'presence') {
        mss_api_respond([
            'success' => true,
            'state' => [
                'users' => mss_state_fetch_users($pdo),
                'sessions' => mss_state_fetch_sessions($pdo),
            ],
        ]);
    }

    mss_state_purge_expired_resolved_notifications($pdo);

    mss_api_respond([
        'success' => true,
        'state' => [
            'users' => mss_state_fetch_users($pdo),
            'sessions' => mss_state_fetch_sessions($pdo),
            'logs' => mss_state_fetch_logs($pdo),
            'inventory' => mss_state_fetch_inventory($pdo),
            'movements' => mss_state_fetch_movements($pdo),
            'residentAccounts' => mss_state_fetch_residents($pdo),
            'requests' => mss_state_fetch_requests($pdo),
            'notifications' => mss_state_fetch_notifications($pdo),
            'notificationPreferences' => mss_state_fetch_notification_preferences($pdo),
            'notificationPopupState' => mss_state_fetch_notification_popup_state($pdo),
            'notificationDismissedState' => mss_state_fetch_notification_dismissed_state($pdo),
            'notificationReadState' => mss_state_fetch_notification_read_state($pdo),
            'notificationResolvedState' => mss_state_fetch_notification_resolved_state($pdo),
            'reportHistory' => mss_state_fetch_report_history($pdo),
        ],
    ]);
}

if (!in_array($method, ['POST', 'PUT'], true)) {
    mss_api_error('Method not allowed.', 405);
}

$input = mss_api_json_input();
$payload = isset($input['state']) && is_array($input['state']) ? $input['state'] : $input;

try {
    $pdo->beginTransaction();

    if (mss_state_has_collection($payload, 'users')) {
        mss_state_replace_users($pdo, mss_state_collection($payload, 'users'));
    }
    if (mss_state_has_collection($payload, 'sessions')) {
        mss_state_replace_sessions($pdo, mss_state_collection($payload, 'sessions'));
    }
    if (mss_state_has_collection($payload, 'logs', ['activityLogs'])) {
        mss_state_replace_logs($pdo, mss_state_collection($payload, 'logs', ['activityLogs']));
    }
    if (mss_state_has_collection($payload, 'inventory')) {
        mss_state_replace_inventory($pdo, mss_state_collection($payload, 'inventory'));
    }
    if (mss_state_has_collection($payload, 'movements')) {
        mss_state_replace_movements($pdo, mss_state_collection($payload, 'movements'));
    }
    if (mss_state_has_collection($payload, 'residentAccounts', ['residents'])) {
        mss_state_replace_residents($pdo, mss_state_collection($payload, 'residentAccounts', ['residents']));
    }
    if (mss_state_has_collection($payload, 'requests', ['choRequests'])) {
        mss_state_replace_requests($pdo, mss_state_collection($payload, 'requests', ['choRequests']));
    }
    if (mss_state_has_collection($payload, 'notifications')) {
        mss_state_replace_notifications($pdo, mss_state_collection($payload, 'notifications'));
    }
    if (mss_state_has_collection($payload, 'notificationPreferences', ['notification_preferences'])) {
        mss_state_replace_notification_preferences($pdo, mss_state_collection($payload, 'notificationPreferences', ['notification_preferences']));
    }
    if (mss_state_has_collection($payload, 'notificationPopupState', ['notification_popup_state'])) {
        mss_state_replace_notification_popup_state($pdo, mss_state_collection($payload, 'notificationPopupState', ['notification_popup_state']));
    }
    if (mss_state_has_collection($payload, 'notificationDismissedState', ['notification_dismissed_state'])) {
        mss_state_replace_notification_dismissed_state($pdo, mss_state_collection($payload, 'notificationDismissedState', ['notification_dismissed_state']));
    }
    if (mss_state_has_collection($payload, 'notificationReadState', ['notification_read_state'])) {
        mss_state_replace_notification_read_state($pdo, mss_state_collection($payload, 'notificationReadState', ['notification_read_state']));
    }
    if (mss_state_has_collection($payload, 'notificationResolvedState', ['notification_resolved_state'])) {
        mss_state_replace_notification_resolved_state($pdo, mss_state_collection($payload, 'notificationResolvedState', ['notification_resolved_state']));
    }
    if (mss_state_has_collection($payload, 'reportHistory', ['report_history'])) {
        mss_state_replace_report_history($pdo, mss_state_collection($payload, 'reportHistory', ['report_history']));
    }

    mss_state_purge_expired_resolved_notifications($pdo);

    $pdo->commit();

    mss_api_respond([
        'success' => true,
        'message' => 'State saved successfully.',
        'state' => [
            'users' => mss_state_fetch_users($pdo),
            'sessions' => mss_state_fetch_sessions($pdo),
            'logs' => mss_state_fetch_logs($pdo),
            'inventory' => mss_state_fetch_inventory($pdo),
            'movements' => mss_state_fetch_movements($pdo),
            'residentAccounts' => mss_state_fetch_residents($pdo),
            'requests' => mss_state_fetch_requests($pdo),
            'notifications' => mss_state_fetch_notifications($pdo),
            'notificationPreferences' => mss_state_fetch_notification_preferences($pdo),
            'notificationPopupState' => mss_state_fetch_notification_popup_state($pdo),
            'notificationDismissedState' => mss_state_fetch_notification_dismissed_state($pdo),
            'notificationReadState' => mss_state_fetch_notification_read_state($pdo),
            'notificationResolvedState' => mss_state_fetch_notification_resolved_state($pdo),
            'reportHistory' => mss_state_fetch_report_history($pdo),
        ],
    ]);
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($exception instanceof MSSStateValidationException) {
        mss_api_error($exception->getMessage(), 422);
    }

    mss_api_error('Unable to save medicine module state right now.', 500);
}
