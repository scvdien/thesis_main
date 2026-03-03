<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/**
 * @param array<string, mixed> $payload
 */
function reports_api_respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function reports_api_error(int $statusCode, string $message): never
{
    reports_api_respond($statusCode, [
        'success' => false,
        'error' => $message,
    ]);
}

function reports_api_text(mixed $value, int $maxLength = 255): string
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

function reports_api_year(mixed $value): int
{
    $fallback = (int) gmdate('Y');
    if (is_numeric($value)) {
        $year = (int) $value;
        if ($year >= 2000 && $year <= 2100) {
            return $year;
        }
    }
    return $fallback;
}

/**
 * @return array<string, mixed>
 */
function reports_api_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function reports_api_can_manage(string $role): bool
{
    return auth_normalize_role($role) === AUTH_ROLE_ADMIN;
}

function reports_api_bootstrap_reports_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `reports` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `report_code` VARCHAR(32) NOT NULL,
            `title` VARCHAR(180) NOT NULL,
            `category` VARCHAR(60) NOT NULL DEFAULT "General",
            `report_period` VARCHAR(80) NOT NULL,
            `period_year` SMALLINT UNSIGNED NOT NULL,
            `status` VARCHAR(20) NOT NULL DEFAULT "Draft",
            `summary` VARCHAR(255) NOT NULL,
            `document_content` LONGTEXT NULL,
            `created_by_user_id` BIGINT UNSIGNED NULL,
            `updated_by_user_id` BIGINT UNSIGNED NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_reports_report_code` (`report_code`),
            KEY `idx_reports_period_year` (`period_year`),
            KEY `idx_reports_updated_at` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function reports_api_item(array $row): array
{
    $updatedAt = (string) ($row['updated_at'] ?? '');
    $updatedTs = strtotime($updatedAt);
    $updatedLabel = $updatedTs !== false ? date('M d, Y', $updatedTs) : date('M d, Y');

    return [
        'report_code' => (string) ($row['report_code'] ?? ''),
        'title' => (string) ($row['title'] ?? ''),
        'category' => (string) ($row['category'] ?? 'General'),
        'period' => (string) ($row['report_period'] ?? ''),
        'period_input' => '',
        'year' => (int) ($row['period_year'] ?? 0),
        'status' => (string) ($row['status'] ?? 'Draft'),
        'summary' => (string) ($row['summary'] ?? ''),
        'document' => (string) ($row['document_content'] ?? ''),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => $updatedAt,
        'updated_label' => $updatedLabel,
    ];
}

function reports_api_next_code(PDO $pdo, int $year): string
{
    $prefix = 'RP-' . $year . '-';
    $stmt = $pdo->prepare(
        'SELECT `report_code`
         FROM `reports`
         WHERE `period_year` = :year AND `report_code` LIKE :prefix
         ORDER BY `id` DESC
         LIMIT 100'
    );
    $stmt->execute([
        'year' => $year,
        'prefix' => $prefix . '%',
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $maxSequence = 0;
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $code = reports_api_text($row['report_code'] ?? '', 40);
        if (preg_match('/^RP-\d{4}-(\d{3,})$/', $code, $matches) !== 1) {
            continue;
        }
        $seq = (int) ($matches[1] ?? 0);
        if ($seq > $maxSequence) {
            $maxSequence = $seq;
        }
    }

    return sprintf('RP-%04d-%03d', $year, $maxSequence + 1);
}

/**
 * @return array<string, mixed>|null
 */
function reports_api_find_by_code(PDO $pdo, string $reportCode): ?array
{
    $stmt = $pdo->prepare(
        'SELECT `id`, `report_code`, `title`, `category`, `report_period`, `period_year`,
                `status`, `summary`, `document_content`, `created_at`, `updated_at`
         FROM `reports`
         WHERE `report_code` = :report_code
         LIMIT 1'
    );
    $stmt->execute(['report_code' => $reportCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

/**
 * @param array<string, mixed> $payload
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function reports_api_create(PDO $pdo, array $payload, array $authUser): array
{
    $title = reports_api_text($payload['title'] ?? '', 180);
    if ($title === '') {
        reports_api_error(422, 'Report title is required.');
    }

    $year = reports_api_year($payload['year'] ?? null);
    $period = reports_api_text($payload['period'] ?? '', 80);
    if ($period === '') {
        $period = 'Year ' . $year;
    }

    $category = reports_api_text($payload['category'] ?? 'General', 60);
    if ($category === '') {
        $category = 'General';
    }

    $summary = reports_api_text($payload['summary'] ?? '', 255);
    if ($summary === '') {
        $summary = 'Report generated from report form.';
    }

    $document = trim((string) ($payload['document'] ?? ''));
    if ($document === '') {
        $document = 'No document content provided.';
    }

    $userId = (int) ($authUser['id'] ?? 0);

    $attempt = 0;
    while ($attempt < 5) {
        $attempt += 1;
        $reportCode = reports_api_next_code($pdo, $year);

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO `reports`
                 (`report_code`, `title`, `category`, `report_period`, `period_year`, `status`,
                  `summary`, `document_content`, `created_by_user_id`, `updated_by_user_id`)
                 VALUES
                 (:report_code, :title, :category, :report_period, :period_year, :status,
                  :summary, :document_content, :created_by_user_id, :updated_by_user_id)'
            );
            $stmt->execute([
                'report_code' => $reportCode,
                'title' => $title,
                'category' => $category,
                'report_period' => $period,
                'period_year' => $year,
                'status' => 'Draft',
                'summary' => $summary,
                'document_content' => $document,
                'created_by_user_id' => $userId > 0 ? $userId : null,
                'updated_by_user_id' => $userId > 0 ? $userId : null,
            ]);

            $created = reports_api_find_by_code($pdo, $reportCode);
            if (!is_array($created)) {
                throw new RuntimeException('Unable to load created report row.');
            }

            auth_audit_log([
                'user' => $authUser,
                'action_key' => 'report_created',
                'action_type' => 'created',
                'module_name' => 'Reports',
                'record_type' => 'report_record',
                'record_id' => $reportCode,
                'details' => 'Created report draft.',
                'metadata' => [
                    'report_code' => $reportCode,
                    'title' => $title,
                    'year' => $year,
                    'table' => 'reports',
                ],
            ]);

            return reports_api_item($created);
        } catch (PDOException $exception) {
            $errorInfo = $exception->errorInfo;
            $mysqlCode = is_array($errorInfo) ? (int) ($errorInfo[1] ?? 0) : 0;
            if ($mysqlCode === 1062) {
                continue;
            }
            throw $exception;
        }
    }

    throw new RuntimeException('Unable to generate a unique report code.');
}

/**
 * @param array<string, mixed> $payload
 * @param array<string, mixed> $authUser
 * @return array<string, mixed>
 */
function reports_api_delete(PDO $pdo, array $payload, array $authUser): array
{
    $reportCode = reports_api_text($payload['report_code'] ?? '', 40);
    if ($reportCode === '') {
        reports_api_error(422, 'Report code is required.');
    }

    $existing = reports_api_find_by_code($pdo, $reportCode);
    if (!is_array($existing)) {
        reports_api_error(404, 'Report not found.');
    }

    $stmt = $pdo->prepare('DELETE FROM `reports` WHERE `report_code` = :report_code LIMIT 1');
    $stmt->execute(['report_code' => $reportCode]);
    if ($stmt->rowCount() < 1) {
        reports_api_error(404, 'Report not found.');
    }

    auth_audit_log([
        'user' => $authUser,
        'action_key' => 'report_deleted',
        'action_type' => 'deleted',
        'module_name' => 'Reports',
        'record_type' => 'report_record',
        'record_id' => $reportCode,
        'details' => 'Deleted report draft.',
        'metadata' => [
            'report_code' => $reportCode,
            'title' => (string) ($existing['title'] ?? ''),
            'year' => (int) ($existing['period_year'] ?? 0),
            'table' => 'reports',
        ],
    ]);

    return [
        'report_code' => $reportCode,
        'deleted' => true,
    ];
}

auth_bootstrap_store();
$authUser = auth_require_api([AUTH_ROLE_CAPTAIN, AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY]);
$authRole = auth_normalize_role((string) ($authUser['role'] ?? ''));
$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    $pdo = auth_db();
    auth_ensure_users_columns($pdo);
    reports_api_bootstrap_reports_table($pdo);

    if ($requestMethod === 'GET') {
        $year = reports_api_year($_GET['year'] ?? gmdate('Y'));

        $stmt = $pdo->prepare(
            'SELECT `id`, `report_code`, `title`, `category`, `report_period`, `period_year`,
                    `status`, `summary`, `document_content`, `created_at`, `updated_at`
             FROM `reports`
             WHERE `period_year` = :year
             ORDER BY `updated_at` DESC, `id` DESC'
        );
        $stmt->execute(['year' => $year]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $items = array_map(static fn(array $row): array => reports_api_item($row), $rows);

        reports_api_respond(200, [
            'success' => true,
            'data' => [
                'items' => $items,
                'year' => $year,
                'count' => count($items),
            ],
        ]);
    }

    if ($requestMethod === 'POST') {
        if (!reports_api_can_manage($authRole)) {
            reports_api_error(403, 'You do not have permission for this action.');
        }

        $payload = reports_api_json_body();
        $action = strtolower(reports_api_text($payload['action'] ?? '', 20));

        if ($action === 'create') {
            $item = reports_api_create($pdo, $payload, $authUser);
            reports_api_respond(201, [
                'success' => true,
                'data' => [
                    'item' => $item,
                ],
            ]);
        }

        if ($action === 'delete') {
            $deleted = reports_api_delete($pdo, $payload, $authUser);
            reports_api_respond(200, [
                'success' => true,
                'data' => $deleted,
            ]);
        }

        reports_api_error(400, 'Invalid action.');
    }

    reports_api_error(405, 'Method not allowed.');
} catch (Throwable $exception) {
    error_log('reports-api.php failed: ' . $exception->getMessage());
    reports_api_error(500, 'Unable to process reports right now.');
}
