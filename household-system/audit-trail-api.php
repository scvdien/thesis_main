<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/**
 * @param array<string, mixed> $payload
 */
function audit_api_respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function audit_api_error(int $statusCode, string $message): never
{
    audit_api_respond($statusCode, [
        'success' => false,
        'error' => $message,
    ]);
}

function audit_api_text(mixed $value, int $maxLength = 255): string
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

/**
 * @param array<string, mixed> $row
 * @return array<string, mixed>
 */
function audit_api_build_item(array $row): array
{
    $metadata = [];
    $metadataRaw = (string) ($row['metadata_json'] ?? '');
    if ($metadataRaw !== '') {
        $decoded = json_decode($metadataRaw, true);
        if (is_array($decoded)) {
            $metadata = $decoded;
        }
    }

    $actorRole = auth_normalize_role((string) ($row['actor_role'] ?? ''));
    $actorRole = $actorRole !== '' ? $actorRole : audit_api_text((string) ($row['actor_role'] ?? ''), 20);
    $userAgent = (string) ($row['user_agent'] ?? '');
    $publicIpAddress = (string) ($row['ip_address'] ?? '');

    return [
        'id' => (int) ($row['id'] ?? 0),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'actor' => [
            'user_id' => (int) ($row['actor_user_id'] ?? 0),
            'username' => (string) ($row['actor_username'] ?? ''),
            'role' => $actorRole,
            'role_label' => auth_role_label($actorRole),
        ],
        'action_key' => (string) ($row['action_key'] ?? ''),
        'action_type' => (string) ($row['action_type'] ?? ''),
        'module_name' => (string) ($row['module_name'] ?? ''),
        'record_type' => (string) ($row['record_type'] ?? ''),
        'record_id' => (string) ($row['record_id'] ?? ''),
        'details' => (string) ($row['details'] ?? ''),
        'ip_address' => $publicIpAddress,
        'public_ip_address' => $publicIpAddress,
        'user_agent' => $userAgent,
        'device_browser' => auth_audit_user_agent_summary($userAgent),
        'metadata' => $metadata,
    ];
}

/**
 * @param array<string, mixed> $filters
 * @return array{whereSql: string, params: array<string, mixed>}
 */
function audit_api_filter_sql(array $filters): array
{
    $where = ' WHERE 1=1';
    $params = [];

    $q = audit_api_text($filters['q'] ?? '', 120);
    if ($q !== '') {
        $likeQuery = '%' . strtolower($q) . '%';
        $where .= ' AND (
            LOWER(`action_key`) LIKE :q_action_key
            OR LOWER(REPLACE(`action_key`, \'_\', \' \')) LIKE :q_action_key_words
            OR LOWER(`action_type`) LIKE :q_action_type
            OR LOWER(`details`) LIKE :q_details
            OR LOWER(`actor_username`) LIKE :q_actor_username
            OR LOWER(`actor_role`) LIKE :q_actor_role
            OR LOWER(`record_id`) LIKE :q_record_id
            OR LOWER(`record_type`) LIKE :q_record_type
            OR LOWER(`module_name`) LIKE :q_module_name
            OR LOWER(`user_agent`) LIKE :q_user_agent
        )';
        $params['q_action_key'] = $likeQuery;
        $params['q_action_key_words'] = $likeQuery;
        $params['q_action_type'] = $likeQuery;
        $params['q_details'] = $likeQuery;
        $params['q_actor_username'] = $likeQuery;
        $params['q_actor_role'] = $likeQuery;
        $params['q_record_id'] = $likeQuery;
        $params['q_record_type'] = $likeQuery;
        $params['q_module_name'] = $likeQuery;
        $params['q_user_agent'] = $likeQuery;
    }

    $actionType = strtolower(audit_api_text($filters['action_type'] ?? '', 40));
    if ($actionType !== '' && $actionType !== 'all') {
        $where .= ' AND `action_type` = :action_type';
        $params['action_type'] = $actionType;
    }

    $userRole = auth_normalize_role(audit_api_text($filters['user_role'] ?? '', 20));
    if ($userRole !== '') {
        $where .= ' AND `actor_role` = :actor_role';
        $params['actor_role'] = $userRole;
    }

    $year = (int) ($filters['year'] ?? 0);
    if ($year >= 2000 && $year <= 2100) {
        $start = sprintf('%04d-01-01 00:00:00', $year);
        $end = sprintf('%04d-12-31 23:59:59', $year);
        $where .= ' AND `created_at` BETWEEN :year_start AND :year_end';
        $params['year_start'] = $start;
        $params['year_end'] = $end;
    }

    return [
        'whereSql' => $where,
        'params' => $params,
    ];
}

auth_bootstrap_store();
$authUser = auth_require_api([AUTH_ROLE_CAPTAIN, AUTH_ROLE_ADMIN, AUTH_ROLE_SECRETARY]);
$pdo = auth_db();
auth_bootstrap_audit_trail_table($pdo);

$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($requestMethod !== 'GET') {
    audit_api_error(405, 'Method not allowed.');
}

$limit = max(1, min(500, (int) ($_GET['limit'] ?? 120)));
$offset = max(0, (int) ($_GET['offset'] ?? 0));

$filters = [
    'q' => $_GET['q'] ?? '',
    'action_type' => $_GET['action_type'] ?? '',
    'user_role' => $_GET['user_role'] ?? '',
    'year' => (int) ($_GET['year'] ?? 0),
];

try {
    $filterSql = audit_api_filter_sql($filters);
    $whereSql = $filterSql['whereSql'];
    $params = $filterSql['params'];

    $listSql = 'SELECT `id`, `actor_user_id`, `actor_username`, `actor_role`, `action_key`, `action_type`,
                       `module_name`, `record_type`, `record_id`, `details`, `metadata_json`, `ip_address`,
                       `user_agent`, `created_at`
                FROM `audit_trail_logs`'
        . $whereSql
        . ' ORDER BY `created_at` DESC, `id` DESC LIMIT ' . $limit . ' OFFSET ' . $offset;
    $listStmt = $pdo->prepare($listSql);
    $listStmt->execute($params);
    $rows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $countSql = 'SELECT COUNT(*) FROM `audit_trail_logs`' . $whereSql;
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $summarySql = 'SELECT COUNT(*) AS total_actions,
                          SUM(CASE WHEN `action_type` = "created" THEN 1 ELSE 0 END) AS created_count,
                          SUM(CASE WHEN `action_type` = "updated" THEN 1 ELSE 0 END) AS updated_count,
                          SUM(CASE WHEN `action_type` = "deleted" THEN 1 ELSE 0 END) AS deleted_count
                   FROM `audit_trail_logs`'
        . $whereSql;
    $summaryStmt = $pdo->prepare($summarySql);
    $summaryStmt->execute($params);
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $yearRows = $pdo->query(
        'SELECT DISTINCT YEAR(`created_at`) AS `year`
         FROM `audit_trail_logs`
         ORDER BY `year` DESC'
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $years = [];
    foreach ($yearRows as $yearRow) {
        if (!is_array($yearRow)) {
            continue;
        }
        $yearValue = (int) ($yearRow['year'] ?? 0);
        if ($yearValue > 0) {
            $years[] = $yearValue;
        }
    }

    $items = array_map(static fn(array $row): array => audit_api_build_item($row), $rows);

    audit_api_respond(200, [
        'success' => true,
        'data' => [
            'items' => $items,
            'count' => count($items),
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'summary' => [
                'total_actions' => (int) ($summary['total_actions'] ?? 0),
                'created_count' => (int) ($summary['created_count'] ?? 0),
                'updated_count' => (int) ($summary['updated_count'] ?? 0),
                'deleted_count' => (int) ($summary['deleted_count'] ?? 0),
            ],
            'filters' => [
                'action_types' => ['all', 'created', 'updated', 'deleted', 'security', 'access'],
                'user_roles' => ['all', AUTH_ROLE_CAPTAIN, AUTH_ROLE_ADMIN, AUTH_ROLE_STAFF],
                'years' => $years,
            ],
        ],
    ]);
} catch (Throwable $exception) {
    audit_api_error(500, 'Unable to load audit trail right now.');
}
