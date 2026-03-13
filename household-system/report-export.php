<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

if (PHP_SAPI !== 'cli') {
    auth_require_api(['captain', 'admin', 'secretary']);
}
const REPORT_NO_DATA_MESSAGE = 'No reported cases for the selected reporting year.';
const REPORT_DATA_SOURCE = 'Online Household Information Management System (HIMS) analytics database';

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

function signatoryText($value, int $max = 160): string
{
    $textValue = text($value, $max);
    if ($textValue === '') {
        return '';
    }

    if (function_exists('mb_strtoupper')) {
        return text(mb_strtoupper($textValue, 'UTF-8'), $max);
    }

    return text(strtoupper($textValue), $max);
}

function esc($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/**
 * @param mixed $headerLines
 * @return list<string>
 */
function normalizeReportHeaderLines($headerLines): array
{
    if (!is_array($headerLines)) {
        return [];
    }

    $normalized = [];
    foreach ($headerLines as $line) {
        $textLine = text($line, 200);
        if ($textLine === '') {
            continue;
        }
        $normalized[] = $textLine;
    }

    return $normalized;
}

/**
 * @param mixed $table
 * @return array{
 *     title:string,
 *     columns:list<string>,
 *     show_header:bool,
 *     rows:list<list<string>>
 * }
 */
function normalizeReportTable($table): array
{
    $defaultColumns = ['Indicator', 'Count'];
    if (!is_array($table)) {
        return [
            'title' => '',
            'columns' => $defaultColumns,
            'show_header' => true,
            'rows' => [],
        ];
    }

    $columns = [];
    $rawColumns = is_array($table['columns'] ?? null) ? array_values($table['columns']) : [];
    foreach ($rawColumns as $column) {
        $columnText = text($column, 120);
        if ($columnText === '') {
            continue;
        }
        $columns[] = $columnText;
    }
    if (!$columns) {
        $columns = $defaultColumns;
    }

    $rows = [];
    $rawRows = is_array($table['rows'] ?? null) ? $table['rows'] : [];
    foreach ($rawRows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $cells = [];
        foreach ($row as $cell) {
            $cells[] = text($cell, 280);
        }
        $rows[] = $cells;
    }

    return [
        'title' => text($table['title'] ?? '', 200),
        'columns' => $columns,
        'show_header' => !array_key_exists('show_header', $table) || $table['show_header'] !== false,
        'rows' => $rows,
    ];
}

/**
 * @param mixed $sections
 * @return list<array{
 *     title:string,
 *     tables:list<array{
 *         title:string,
 *         columns:list<string>,
 *         show_header:bool,
 *         rows:list<list<string>>
 *     }>
 * }>
 */
function normalizeReportSections($sections): array
{
    if (!is_array($sections)) {
        return [];
    }

    $normalized = [];
    foreach ($sections as $section) {
        if (!is_array($section)) {
            continue;
        }

        $tables = [];
        $rawTables = is_array($section['tables'] ?? null) ? $section['tables'] : [];
        foreach ($rawTables as $table) {
            $tables[] = normalizeReportTable($table);
        }

        $normalized[] = [
            'title' => text($section['title'] ?? '', 200),
            'tables' => $tables,
        ];
    }

    return $normalized;
}

/**
 * @param mixed $metaBlock
 * @return list<array{label:string,value:string}>
 */
function normalizeReportMetaBlock($metaBlock): array
{
    if (!is_array($metaBlock)) {
        return [];
    }

    $normalized = [];
    foreach ($metaBlock as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $label = text($entry['label'] ?? '', 120);
        $value = text($entry['value'] ?? '', 260);
        if ($label === '' && $value === '') {
            continue;
        }

        $normalized[] = [
            'label' => $label,
            'value' => $value,
        ];
    }

    return $normalized;
}

/**
 * @param mixed $value
 * @return array<string, mixed>
 */
function normalizeAssocArray($value): array
{
    return is_array($value) ? $value : [];
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

/**
 * @param array<string, mixed> $report
 */
function reportYearValue(array $report): int
{
    return parseSelectedYear($report['year'] ?? null);
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

/**
 * @return array<int, string>
 */
function envList(array $keys): array
{
    $raw = envValue($keys, '');
    if ($raw === '') {
        return [];
    }

    $parts = preg_split('/[\r\n,;]+/', $raw);
    if (!is_array($parts)) {
        return [];
    }

    $values = [];
    foreach ($parts as $part) {
        $item = trim((string) $part);
        if ($item !== '') {
            $values[] = $item;
        }
    }

    return array_values(array_unique($values));
}

/**
 * @return array<int, string>
 */
function excelCliPhpCandidates(): array
{
    $custom = envValue(['EXCEL_EXPORT_PHP_BINARY', 'REPORT_EXPORT_PHP_BINARY'], '');
    $configured = envList(['EXCEL_EXPORT_PHP_BINARIES', 'REPORT_EXPORT_PHP_BINARIES']);
    $items = array_merge([$custom, PHP_BINARY], $configured);
    $candidates = [];
    foreach ($items as $item) {
        $path = trim((string) $item);
        if ($path !== '') {
            $candidates[] = $path;
        }
    }
    return array_values(array_unique($candidates));
}

function findExcelCliPhpBinary(): ?string
{
    foreach (excelCliPhpCandidates() as $candidate) {
        if (is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }
    return null;
}

function exportSpreadsheetUsingExternalPhp(
    array $report,
    array $profile,
    string $phpBinary,
    ?string &$errorMessage = null
): ?string {
    $tmpDir = sys_get_temp_dir();
    $inputFile = tempnam($tmpDir, 'hims_xlsx_in_');
    $outputBase = tempnam($tmpDir, 'hims_xlsx_out_');
    if (!is_string($inputFile) || !is_string($outputBase)) {
        $errorMessage = 'Unable to allocate temporary files for Excel export.';
        return null;
    }

    if (is_file($outputBase)) {
        @unlink($outputBase);
    }
    $outputFile = $outputBase . '.xlsx';

    $payloadJson = json_encode(
        ['report' => $report, 'profile' => $profile],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if (!is_string($payloadJson) || @file_put_contents($inputFile, $payloadJson) === false) {
        @unlink($inputFile);
        $errorMessage = 'Unable to prepare temporary Excel payload.';
        return null;
    }

    $command = escapeshellarg($phpBinary)
        . ' ' . escapeshellarg(__FILE__)
        . ' --excel-cli ' . escapeshellarg($inputFile)
        . ' ' . escapeshellarg($outputFile)
        . ' 2>&1';

    $outputLines = [];
    $exitCode = 1;
    @exec($command, $outputLines, $exitCode);
    @unlink($inputFile);

    if ($exitCode !== 0 || !is_file($outputFile) || (int) @filesize($outputFile) <= 0) {
        @unlink($outputFile);
        $errorMessage = trim(implode("\n", $outputLines)) ?: 'External Excel export process failed.';
        return null;
    }

    $errorMessage = null;
    return $outputFile;
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

function nfmt($value, int $decimals = 0): string
{
    return number_format((float) $value, $decimals);
}

function reportProfileDefaults(): array
{
    return [
        'region_name' => '',
        'province_name' => '',
        'city_name' => '',
        'barangay_name' => '',
        'barangay_code' => '',
        'captain_name' => '',
        'secretary_name' => '',
        'official_seal_path' => '',
    ];
}

function reportProfileColumnExists(PDO $pdo, string $tableName, string $columnName): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM `information_schema`.`COLUMNS`
         WHERE `TABLE_SCHEMA` = DATABASE()
           AND `TABLE_NAME` = :table_name
           AND `COLUMN_NAME` = :column_name
         LIMIT 1'
    );
    $stmt->execute([
        'table_name' => $tableName,
        'column_name' => $columnName,
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function reportProfileTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `barangay_profile` (
            `id` TINYINT UNSIGNED NOT NULL,
            `region_name` VARCHAR(120) NULL,
            `province_name` VARCHAR(120) NULL,
            `city_name` VARCHAR(120) NULL,
            `barangay_name` VARCHAR(160) NULL,
            `barangay_code` VARCHAR(80) NULL,
            `captain_name` VARCHAR(160) NULL,
            `secretary_name` VARCHAR(160) NULL,
            `official_seal_path` VARCHAR(255) NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $requiredColumns = [
        'region_name' => 'VARCHAR(120) NULL',
        'province_name' => 'VARCHAR(120) NULL',
        'city_name' => 'VARCHAR(120) NULL',
        'barangay_name' => 'VARCHAR(160) NULL',
        'barangay_code' => 'VARCHAR(80) NULL',
        'captain_name' => 'VARCHAR(160) NULL',
        'secretary_name' => 'VARCHAR(160) NULL',
        'official_seal_path' => 'VARCHAR(255) NULL',
        'updated_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ];
    foreach ($requiredColumns as $columnName => $definition) {
        if (reportProfileColumnExists($pdo, 'barangay_profile', $columnName)) {
            continue;
        }
        $pdo->exec('ALTER TABLE `barangay_profile` ADD COLUMN `' . $columnName . '` ' . $definition);
    }

    foreach (['email', 'contact_number', 'hall_address'] as $legacyColumn) {
        if (!reportProfileColumnExists($pdo, 'barangay_profile', $legacyColumn)) {
            continue;
        }
        $pdo->exec('ALTER TABLE `barangay_profile` DROP COLUMN `' . $legacyColumn . '`');
    }
}

function reportProfileFromUsers(PDO $pdo): array
{
    $names = [
        'captain_name' => '',
        'secretary_name' => '',
    ];

    try {
        $captainStmt = $pdo->prepare(
            'SELECT `full_name`
             FROM `users`
             WHERE `role` = :role
             ORDER BY `id` ASC
             LIMIT 1'
        );
        $captainStmt->execute(['role' => 'captain']);
        $captainName = $captainStmt->fetchColumn();
        if (is_string($captainName) && trim($captainName) !== '') {
            $names['captain_name'] = trim($captainName);
        }

        $secretaryStmt = $pdo->query(
            'SELECT `full_name`
             FROM `users`
             WHERE `role` IN ("secretary", "admin")
             ORDER BY FIELD(`role`, "secretary", "admin"), `id` ASC
             LIMIT 1'
        );
        $secretaryName = $secretaryStmt instanceof PDOStatement ? $secretaryStmt->fetchColumn() : '';
        if (is_string($secretaryName) && trim($secretaryName) !== '') {
            $names['secretary_name'] = trim($secretaryName);
        }
    } catch (Throwable $e) {
        // User table may be unavailable in partial deployments.
    }

    return $names;
}

/**
 * @return array<string, string>
 */
function reportProfileData(?PDO $pdo): array
{
    $profile = reportProfileDefaults();
    $userNames = [
        'captain_name' => '',
        'secretary_name' => '',
    ];

    if ($pdo instanceof PDO) {
        try {
            reportProfileTable($pdo);
            $stmt = $pdo->prepare(
                'SELECT
                    `region_name`,
                    `province_name`,
                    `city_name`,
                    `barangay_name`,
                    `barangay_code`,
                    `captain_name`,
                    `secretary_name`,
                    `official_seal_path`
                 FROM `barangay_profile`
                 WHERE `id` = 1
                 LIMIT 1'
            );
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($row)) {
                foreach ($profile as $key => $value) {
                    $profile[$key] = text($row[$key] ?? '', 255);
                }
            }
        } catch (Throwable $e) {
            // Profile table is optional; fall back to user account data.
        }

        $userNames = reportProfileFromUsers($pdo);
    }

    if ($profile['captain_name'] === '') {
        $profile['captain_name'] = $userNames['captain_name'] ?? '';
    }
    if ($profile['secretary_name'] === '') {
        $profile['secretary_name'] = $userNames['secretary_name'] ?? '';
    }

    return $profile;
}

function reportImageMimeFromExtension(string $path): string
{
    $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
    return match ($extension) {
        'png' => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        default => '',
    };
}

/**
 * @param array<string, string> $profile
 */
function reportOfficialSealAbsolutePath(array $profile): string
{
    $relativePath = text($profile['official_seal_path'] ?? '', 255);
    if ($relativePath === '') {
        return '';
    }

    $normalized = ltrim(trim(str_replace('\\', '/', $relativePath)), '/');
    $prefix = 'assets/img/official-seals/';
    if (strpos($normalized, $prefix) !== 0) {
        return '';
    }

    $fileName = basename($normalized);
    if ($fileName === '' || $fileName === '.' || $fileName === '..') {
        return '';
    }

    $absolutePath = __DIR__ . '/assets/img/official-seals/' . $fileName;
    if (!is_file($absolutePath)) {
        return '';
    }

    return $absolutePath;
}

function reportOfficialSealDataUri(string $absoluteSealPath): string
{
    if ($absoluteSealPath === '' || !is_file($absoluteSealPath)) {
        return '';
    }

    $mime = reportImageMimeFromExtension($absoluteSealPath);
    if ($mime === '') {
        return '';
    }

    $binary = @file_get_contents($absoluteSealPath);
    if (!is_string($binary) || $binary === '') {
        return '';
    }

    return 'data:' . $mime . ';base64,' . base64_encode($binary);
}

/**
 * @return array{path:string,is_temp:bool}
 */
function prepareFpdfWatermarkImage(string $absoluteSealPath): array
{
    $fallback = ['path' => '', 'is_temp' => false];
    if ($absoluteSealPath === '' || !is_file($absoluteSealPath)) {
        return $fallback;
    }

    $mime = reportImageMimeFromExtension($absoluteSealPath);
    $extension = strtolower((string) pathinfo($absoluteSealPath, PATHINFO_EXTENSION));
    if (
        !function_exists('imagecreatetruecolor')
        || !function_exists('imagecopyresampled')
        || !function_exists('imagepng')
    ) {
        if (in_array($extension, ['png', 'jpg', 'jpeg'], true)) {
            return ['path' => $absoluteSealPath, 'is_temp' => false];
        }
        return $fallback;
    }

    $createFn = match ($mime) {
        'image/png' => 'imagecreatefrompng',
        'image/jpeg' => 'imagecreatefromjpeg',
        'image/webp' => 'imagecreatefromwebp',
        default => '',
    };

    if ($createFn === '' || !function_exists($createFn)) {
        if (in_array($extension, ['png', 'jpg', 'jpeg'], true)) {
            return ['path' => $absoluteSealPath, 'is_temp' => false];
        }
        return $fallback;
    }

    $source = @$createFn($absoluteSealPath);
    if (!is_resource($source) && !($source instanceof GdImage)) {
        if (in_array($extension, ['png', 'jpg', 'jpeg'], true)) {
            return ['path' => $absoluteSealPath, 'is_temp' => false];
        }
        return $fallback;
    }

    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    if ($sourceWidth <= 0 || $sourceHeight <= 0) {
        imagedestroy($source);
        return $fallback;
    }

    $maxDimension = 1200.0;
    $scale = min(1.0, $maxDimension / max($sourceWidth, $sourceHeight));
    $targetWidth = max(1, (int) round($sourceWidth * $scale));
    $targetHeight = max(1, (int) round($sourceHeight * $scale));

    $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
    if (!is_resource($canvas) && !($canvas instanceof GdImage)) {
        imagedestroy($source);
        return $fallback;
    }

    imagealphablending($canvas, true);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefilledrectangle($canvas, 0, 0, $targetWidth, $targetHeight, $white);
    imagecopyresampled(
        $canvas,
        $source,
        0,
        0,
        0,
        0,
        $targetWidth,
        $targetHeight,
        $sourceWidth,
        $sourceHeight
    );

    $tempBase = tempnam(sys_get_temp_dir(), 'hims_pdf_wm_');
    if (!is_string($tempBase) || $tempBase === '') {
        imagedestroy($canvas);
        imagedestroy($source);
        return $fallback;
    }
    if (is_file($tempBase)) {
        @unlink($tempBase);
    }
    $tempPath = $tempBase . '.png';

    $saved = @imagepng($canvas, $tempPath, 8);
    imagedestroy($canvas);
    imagedestroy($source);

    if ($saved !== true || !is_file($tempPath)) {
        @unlink($tempPath);
        return $fallback;
    }

    return ['path' => $tempPath, 'is_temp' => true];
}

function drawFpdfWatermark(FPDF $pdf, string $watermarkImagePath): void
{
    if ($watermarkImagePath === '' || !is_file($watermarkImagePath)) {
        return;
    }

    $maxWidth = 155.0;
    $maxHeight = 155.0;
    $drawWidth = $maxWidth;
    $drawHeight = $maxHeight;

    $imageInfo = @getimagesize($watermarkImagePath);
    if (is_array($imageInfo)) {
        $sourceWidth = (float) ($imageInfo[0] ?? 0);
        $sourceHeight = (float) ($imageInfo[1] ?? 0);
        if ($sourceWidth > 0.0 && $sourceHeight > 0.0) {
            $scale = min($maxWidth / $sourceWidth, $maxHeight / $sourceHeight);
            $drawWidth = max(1.0, $sourceWidth * $scale);
            $drawHeight = max(1.0, $sourceHeight * $scale);
        }
    }

    $watermarkX = ($pdf->GetPageWidth() - $drawWidth) / 2.0;
    $watermarkY = ($pdf->GetPageHeight() - $drawHeight) / 2.0;
    applyFpdfAlpha($pdf, 0.10);
    $pdf->Image($watermarkImagePath, $watermarkX, $watermarkY, $drawWidth, $drawHeight);
    applyFpdfAlpha($pdf, 1.0);
}

function applyFpdfAlpha(FPDF $pdf, float $alpha, string $blendMode = 'Normal'): void
{
    $callable = [$pdf, 'SetAlpha'];
    if (!is_callable($callable)) {
        return;
    }

    $callable($alpha, $blendMode);
}

/**
 * @param array{captain:string,secretary:string,date_generated:string} $footerData
 */
function drawFpdfSignatureFooter(
    FPDF $pdf,
    array $footerData,
    string $watermarkImagePath,
    float $scale,
    float $bottomPadding
): void {
    $nameHeight = max(3.6, 5.0 * $scale);
    $titleHeight = max(3.1, 4.3 * $scale);
    $dateHeight = max(3.4, 4.7 * $scale);
    $betweenRows = max(0.6, 1.2 * $scale);
    $beforeDateGap = max(6.0, 10.0 * $scale);
    $beforeFooterGap = max(2.0, 3.5 * $scale);
    $footerHeight = $beforeFooterGap + $nameHeight + $betweenRows + $titleHeight + $beforeDateGap + $dateHeight;

    if ($pdf->GetY() + $footerHeight > $pdf->GetPageHeight() - $bottomPadding) {
        $pdf->AddPage();
        drawFpdfWatermark($pdf, $watermarkImagePath);
    }

    $targetY = max(
        $pdf->GetY() + $beforeFooterGap,
        $pdf->GetPageHeight() - $footerHeight - $bottomPadding
    );
    $pdf->SetY($targetY);

    $pageWidth = $pdf->GetPageWidth();
    $outerPadding = 20.0;
    $columnWidth = 72.0;
    $leftX = $outerPadding;
    $rightX = $pageWidth - $outerPadding - $columnWidth;

    $pdf->SetFont('Times', 'B', max(7.2, 10.0 * $scale));
    $pdf->SetXY($leftX, $targetY);
    $pdf->Cell($columnWidth, $nameHeight, toPdfText(text($footerData['captain'] ?? '', 160)), 0, 0, 'C');
    $pdf->SetXY($rightX, $targetY);
    $pdf->Cell($columnWidth, $nameHeight, toPdfText(text($footerData['secretary'] ?? '', 160)), 0, 0, 'C');

    $titleY = $targetY + $nameHeight + $betweenRows;
    $pdf->SetFont('Times', '', max(6.8, 9.0 * $scale));
    $pdf->SetXY($leftX, $titleY);
    $pdf->Cell($columnWidth, $titleHeight, toPdfText('Brgy Captain'), 0, 0, 'C');
    $pdf->SetXY($rightX, $titleY);
    $pdf->Cell($columnWidth, $titleHeight, toPdfText('Secretary'), 0, 0, 'C');

    $dateY = $titleY + $titleHeight + $beforeDateGap;
    $pdf->SetY($dateY);
    $pdf->SetFont('Times', '', max(6.8, 9.2 * $scale));
    $pdf->Cell(0, $dateHeight, toPdfText(text($footerData['date_generated'] ?? '', 180)), 0, 1, 'C');
}

/**
 * @param array<string, string> $profile
 * @return array{
 *     prepared: array{label:string,name:string,title:string},
 *     approved: array{label:string,name:string,title:string}
 * }
 */
function annualSignatories(array $profile): array
{
    $preparedName = signatoryText($profile['secretary_name'] ?? '', 160);
    $approvedName = signatoryText($profile['captain_name'] ?? '', 160);

    if ($preparedName === '') {
        $preparedName = signatoryText(envValue(['BARANGAY_SECRETARY_NAME'], ''), 160);
    }
    if ($approvedName === '') {
        $approvedName = signatoryText(envValue(['BARANGAY_CAPTAIN_NAME'], ''), 160);
    }
    if ($preparedName === '') {
        $preparedName = 'Not specified';
    }
    if ($approvedName === '') {
        $approvedName = 'Not specified';
    }

    return [
        'prepared' => ['label' => 'Prepared by:', 'name' => $preparedName, 'title' => 'Barangay Secretary'],
        'approved' => ['label' => 'Approved by:', 'name' => $approvedName, 'title' => 'Punong Barangay'],
    ];
}

/**
 * @param array<string, string> $profile
 * @param array<string, mixed> $report
 * @return array{captain:string,secretary:string,date_generated:string}
 */
function reportFooterData(array $profile, array $report): array
{
    $captain = signatoryText($profile['captain_name'] ?? '', 160);
    $secretary = signatoryText($profile['secretary_name'] ?? '', 160);
    if ($captain === '' || $secretary === '') {
        $signatories = annualSignatories($profile);
        if ($captain === '') {
            $captain = signatoryText(($signatories['approved']['name'] ?? ''), 160);
        }
        if ($secretary === '') {
            $secretary = signatoryText(($signatories['prepared']['name'] ?? ''), 160);
        }
    }
    if ($captain === '') {
        $captain = 'Not specified';
    }
    if ($secretary === '') {
        $secretary = 'Not specified';
    }

    $dateGenerated = '';
    $metaBlock = normalizeReportMetaBlock($report['meta_block'] ?? null);
    foreach ($metaBlock as $entry) {
        $label = strtolower(text($entry['label'] ?? '', 80));
        if ($label !== 'date generated') {
            continue;
        }
        $dateGenerated = text($entry['value'] ?? '', 160);
        if ($dateGenerated !== '') {
            break;
        }
    }
    if ($dateGenerated === '') {
        $dateGenerated = date('F j, Y g:i A');
    }

    return [
        'captain' => $captain,
        'secretary' => $secretary,
        'date_generated' => $dateGenerated,
    ];
}

/**
 * @param array<string, string> $profile
 */
function reportFileName(array $profile, int $year, string $format): string
{
    $name = text($profile['barangay_name'] ?? '', 160);
    if ($name === '') {
        $name = envValue(['BARANGAY_NAME'], 'Barangay');
    }
    $slug = preg_replace('/[^A-Za-z0-9]+/', '_', $name);
    if ($slug === null || trim($slug, '_') === '') {
        $slug = 'Barangay';
    } else {
        $slug = trim($slug, '_');
    }

    $extension = strtolower(text($format, 8));
    if ($extension !== 'pdf' && $extension !== 'xlsx') {
        $extension = 'pdf';
    }

    return $slug . '_Annual_Report_' . $year . '.' . $extension;
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

/**
 * @param mixed $map
 * @return array<string, int>
 */
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

/**
 * @param array<string, int|float|string|null> $source
 * @param list<string> $keys
 */
function mapCountValue(array $source, array $keys): int
{
    if (!$source) {
        return 0;
    }
    $lookup = [];
    foreach ($source as $label => $value) {
        $lookup[strtolower(text($label, 200))] = toInt($value, 0);
    }
    foreach ($keys as $key) {
        $normalized = strtolower(text($key, 200));
        if ($normalized !== '' && array_key_exists($normalized, $lookup)) {
            return (int) $lookup[$normalized];
        }
    }
    return 0;
}

/**
 * @param array<string, string> $profile
 * @param array{
 *     employment?: mixed,
 *     education?: mixed,
 *     marital?: mixed,
 *     toilet?: mixed,
 *     water?: mixed,
 *     electricity?: mixed,
 *     ownership?: mixed,
 *     age_brackets?: mixed,
 *     ages?: mixed,
 *     other_indicators?: mixed,
 *     population?: mixed,
 *     male?: mixed,
 *     female?: mixed,
 *     households?: mixed,
 *     avg_household?: mixed
 * } $metrics
 * @return array{
 *     year:int,
 *     title:string,
 *     header_lines:list<string>,
 *     sections:list<array{
 *         title:string,
 *         tables:list<array{
 *             title:string,
 *             columns:list<string>,
 *             show_header:bool,
 *             rows:list<list<string>>
 *         }>
 *     }>,
 *     meta_block:list<array{label:string,value:string}>
 * }
 */
function buildOfficeReportData(int $year, array $profile, array $metrics): array
{
    /** @var array<string, int> $employment */
    $employment = mapCountsFromPayload($metrics['employment'] ?? null);
    /** @var array<string, int> $education */
    $education = mapCountsFromPayload($metrics['education'] ?? null);
    /** @var array<string, int> $marital */
    $marital = mapCountsFromPayload($metrics['marital'] ?? null);
    /** @var array<string, int> $toilet */
    $toilet = mapCountsFromPayload($metrics['toilet'] ?? null);
    /** @var array<string, int> $water */
    $water = mapCountsFromPayload($metrics['water'] ?? null);
    /** @var array<string, int> $electricity */
    $electricity = mapCountsFromPayload($metrics['electricity'] ?? null);
    /** @var array<string, int> $ownership */
    $ownership = mapCountsFromPayload($metrics['ownership'] ?? null);
    /** @var array<string, int> $ageBrackets */
    $ageBrackets = mapCountsFromPayload($metrics['age_brackets'] ?? null);
    if (!$ageBrackets) {
        $ageBrackets = mapCountsFromPayload($metrics['ages'] ?? null);
    }
    /** @var array<string, int> $otherIndicators */
    $otherIndicators = mapCountsFromPayload($metrics['other_indicators'] ?? null);

    $province = text($profile['province_name'] ?? '', 120);
    if ($province === '') {
        $province = envValue(['BARANGAY_PROVINCE', 'PROVINCE_NAME'], '');
    }
    $city = text($profile['city_name'] ?? '', 120);
    if ($city === '') {
        $city = envValue(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], '');
    }
    $barangay = text($profile['barangay_name'] ?? '', 160);
    if ($barangay === '') {
        $barangay = envValue(['BARANGAY_NAME'], 'Barangay');
    }

    $population = max(0, toInt($metrics['population'] ?? 0));
    $male = max(0, toInt($metrics['male'] ?? 0));
    $female = max(0, toInt($metrics['female'] ?? 0));
    $households = max(0, toInt($metrics['households'] ?? 0));
    $avgHousehold = max(0.0, toFloat($metrics['avg_household'] ?? 0.0));

    /** @var Closure(): list<string> $noDataRow */
    $noDataRow = static function (): array {
        return [REPORT_NO_DATA_MESSAGE, '-'];
    };

    /** @var Closure(array<string, int>): (array{label:string,count:int}|null) $topEntry */
    $topEntry = static function (array $counts): ?array {
        $clean = [];
        foreach ($counts as $label => $value) {
            $name = text($label, 160);
            if ($name === '') {
                continue;
            }
            $clean[$name] = max(0, toInt($value, 0));
        }
        if (!$clean) {
            return null;
        }
        arsort($clean, SORT_NUMERIC);
        foreach ($clean as $label => $count) {
            if ($count > 0) {
                return ['label' => $label, 'count' => $count];
            }
        }
        return null;
    };

    /** @var Closure(array<string, int>, int): list<list<string>> $fixedRows */
    $fixedRows = static function (array $counts, int $denominator) use ($noDataRow): array {
        $rows = [];
        $hasData = false;
        foreach ($counts as $label => $value) {
            $count = max(0, toInt($value, 0));
            if ($count > 0) {
                $hasData = true;
            }
            $rows[] = [
                text($label, 180),
                nfmt($count),
            ];
        }
        return $hasData ? $rows : [$noDataRow()];
    };

    /** @var Closure(array<string, int>, int): list<list<string>> $dynamicRows */
    $dynamicRows = static function (array $counts, int $denominator) use ($noDataRow): array {
        $clean = [];
        foreach ($counts as $label => $value) {
            $name = text($label, 180);
            if ($name === '') {
                continue;
            }
            $clean[$name] = max(0, toInt($value, 0));
        }
        if (!$clean) {
            return [$noDataRow()];
        }
        arsort($clean, SORT_NUMERIC);
        $rows = [];
        $hasData = false;
        foreach ($clean as $label => $count) {
            if ($count > 0) {
                $hasData = true;
            }
            $rows[] = [
                $label,
                nfmt($count),
            ];
        }
        return $hasData ? $rows : [$noDataRow()];
    };

    /** @var Closure(array<string, int>, int): int $distributionTotal */
    $distributionTotal = static function (array $counts, int $fallback): int {
        if ($fallback > 0) {
            return $fallback;
        }
        $sum = 0;
        foreach ($counts as $value) {
            $sum += max(0, toInt($value, 0));
        }
        return max(0, $sum);
    };

    /** @var array<string, int> $ageCounts */
    $ageCounts = [
        '0-5' => mapCountValue($ageBrackets, ['0-5']),
        '6-10' => mapCountValue($ageBrackets, ['6-10']),
        '11-15' => mapCountValue($ageBrackets, ['11-15']),
        '16-20' => mapCountValue($ageBrackets, ['16-20']),
        '21-30' => mapCountValue($ageBrackets, ['21-30']),
        '31-40' => mapCountValue($ageBrackets, ['31-40']),
        '41-50' => mapCountValue($ageBrackets, ['41-50']),
        '51-60' => mapCountValue($ageBrackets, ['51-60']),
        '61-70' => mapCountValue($ageBrackets, ['61-70']),
        '71+' => mapCountValue($ageBrackets, ['71+']),
    ];

    /** @var array<string, int> $employmentCounts */
    $employmentCounts = [
        'Employed' => mapCountValue($employment, ['Employed', 'employed']),
        'Unemployed' => mapCountValue($employment, ['Unemployed', 'unemployed']),
        'Self-Employed' => mapCountValue($employment, ['Self-Employed', 'self employed', 'self-employed']),
    ];

    /** @var array<string, int> $educationCounts */
    $educationCounts = [
        'No Schooling' => mapCountValue($education, ['No Schooling', 'no schooling']),
        'Elementary' => mapCountValue($education, ['Elementary', 'elementary']),
        'High School' => mapCountValue($education, ['High School', 'high school']),
        'College' => mapCountValue($education, ['College', 'college']),
        'Vocational' => mapCountValue($education, ['Vocational', 'vocational']),
    ];

    /** @var array<string, int> $civilStatusCounts */
    $civilStatusCounts = [
        'Single' => mapCountValue($marital, ['Single', 'single']),
        'Married' => mapCountValue($marital, ['Married', 'married']),
        'Widowed' => mapCountValue($marital, ['Widowed', 'widowed', 'widow', 'widower']),
        'Separated' => mapCountValue($marital, ['Separated', 'separated']),
        'Other' => mapCountValue($marital, ['Other', 'other']),
    ];

    /** @var array<string, int> $socialIndicatorCounts */
    $socialIndicatorCounts = [
        'Persons with Disability (PWD)' => mapCountValue($otherIndicators, ['PWD', 'pwd']),
        'Senior Citizens' => mapCountValue($otherIndicators, ['Senior Citizens', 'senior citizens', 'senior_citizens']),
        'Solo Parents' => mapCountValue($otherIndicators, ['Solo Parents', 'solo parents', 'solo_parents']),
    ];

    $ageLeader = $topEntry($ageCounts);
    $educationLeader = $topEntry($educationCounts);
    $employmentLeader = $topEntry($employmentCounts);

    $executiveRows = [
        ['Total Population', nfmt($population)],
        ['Total Households', nfmt($households)],
        ['Male Population', nfmt($male)],
        ['Female Population', nfmt($female)],
        ['Average Household Size', nfmt($avgHousehold, 2)],
    ];

    $highlightRows = [];
    if (is_array($ageLeader)) {
        $highlightRows[] = [
            'Largest Age Group (' . text($ageLeader['label'] ?? '', 120) . ')',
            nfmt(toInt($ageLeader['count'] ?? 0)),
        ];
    }
    if (is_array($educationLeader)) {
        $highlightRows[] = [
            'Most Common Educational Attainment (' . text($educationLeader['label'] ?? '', 120) . ')',
            nfmt(toInt($educationLeader['count'] ?? 0)),
        ];
    }
    if (is_array($employmentLeader)) {
        $highlightRows[] = [
            'Most Common Employment Status (' . text($employmentLeader['label'] ?? '', 120) . ')',
            nfmt(toInt($employmentLeader['count'] ?? 0)),
        ];
    }
    if (!$highlightRows) {
        $highlightRows[] = $noDataRow();
    }

    $signatories = annualSignatories($profile);
    $prepared = $signatories['prepared'];
    $reviewed = $signatories['approved'];
    $preparedBy = text(($prepared['name'] ?? 'Not specified') . ' - ' . ($prepared['title'] ?? 'Barangay Secretary'), 220);
    $reviewedBy = text(($reviewed['name'] ?? 'Not specified') . ' - ' . ($reviewed['title'] ?? 'Punong Barangay'), 220);

    $standardColumns = ['Indicator', 'Count'];
    /** @var list<string> $headerLines */
    $headerLines = [
        'Republic of the Philippines',
        'Province of ' . $province,
        'Municipality of ' . $city,
        'BARANGAY ' . strtoupper($barangay),
    ];

    /** @var list<list<string>> $populationProfileRows */
    $populationProfileRows = [
        ['Total Population', nfmt($population)],
        ['Male Population', nfmt($male)],
        ['Female Population', nfmt($female)],
        ['Total Households', nfmt($households)],
        ['Average Household Size', nfmt($avgHousehold, 2)],
    ];

    /** @var list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}> $executiveTables */
    $executiveTables = [
        [
            'title' => 'Key Metrics',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $executiveRows,
        ],
        [
            'title' => 'Highlights',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $highlightRows,
        ],
    ];

    /** @var list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}> $sectionsPopulationTables */
    $sectionsPopulationTables = [
        [
            'title' => '',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $populationProfileRows,
        ],
    ];

    /** @var list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}> $ageTables */
    $ageTables = [[
        'title' => '',
        'columns' => $standardColumns,
        'show_header' => true,
        'rows' => $fixedRows($ageCounts, $population),
    ]];

    /** @var list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}> $socioeconomicTables */
    $socioeconomicTables = [
        [
            'title' => 'Employment Status',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $fixedRows($employmentCounts, $population),
        ],
        [
            'title' => 'Educational Attainment',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $fixedRows($educationCounts, $population),
        ],
        [
            'title' => 'Civil Status',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $fixedRows($civilStatusCounts, $population),
        ],
        [
            'title' => 'Social Indicators',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $fixedRows($socialIndicatorCounts, $population),
        ],
    ];

    /** @var list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}> $housingTables */
    $housingTables = [
        [
            'title' => 'Toilet Type',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $dynamicRows($toilet, $distributionTotal($toilet, $households)),
        ],
        [
            'title' => 'Water Source',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $dynamicRows($water, $distributionTotal($water, $households)),
        ],
        [
            'title' => 'Electricity Source',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $dynamicRows($electricity, $distributionTotal($electricity, $households)),
        ],
        [
            'title' => 'Housing Ownership',
            'columns' => $standardColumns,
            'show_header' => true,
            'rows' => $dynamicRows($ownership, $distributionTotal($ownership, $households)),
        ],
    ];

    /** @var list<array{title:string,tables:list<array{title:string,columns:list<string>,show_header:bool,rows:list<list<string>>}>}> $sections */
    $sections = [
        [
            'title' => 'A. Executive Summary',
            'tables' => $executiveTables,
        ],
        [
            'title' => 'B. Population and Household Profile',
            'tables' => $sectionsPopulationTables,
        ],
        [
            'title' => 'C. Age Group Distribution',
            'tables' => $ageTables,
        ],
        [
            'title' => 'D. Socioeconomic Profile',
            'tables' => $socioeconomicTables,
        ],
        [
            'title' => 'E. Housing and Utilities',
            'tables' => $housingTables,
        ],
    ];

    /** @var list<array{label:string,value:string}> $metaBlock */
    $metaBlock = [
        ['label' => 'Prepared by', 'value' => $preparedBy],
        ['label' => 'Reviewed by', 'value' => $reviewedBy],
        ['label' => 'Date Generated', 'value' => date('F j, Y g:i A')],
        ['label' => 'Data Source', 'value' => REPORT_DATA_SOURCE],
    ];

    return [
        'year' => $year,
        'title' => 'OFFICE OF THE PUNONG BARANGAY',
        'header_lines' => $headerLines,
        'sections' => $sections,
        'meta_block' => $metaBlock,
    ];
}

/**
 * @param array<string, mixed> $analytics
 * @param array<string, string> $profile
 * @return array{
 *     year:int,
 *     title:string,
 *     header_lines:list<string>,
 *     sections:list<array{
 *         title:string,
 *         tables:list<array{
 *             title:string,
 *             columns:list<string>,
 *             show_header:bool,
 *             rows:list<list<string>>
 *         }>
 *     }>,
 *     meta_block:list<array{label:string,value:string}>
 * }|null
 */
function buildAnnualReportDataFromAnalytics(array $analytics, int $year, array $profile): ?array
{
    /** @var array<string, mixed> $populationSummary */
    $populationSummary = normalizeAssocArray($analytics['population_summary'] ?? null);
    /** @var array<string, int> $ageBrackets */
    $ageBrackets = mapCountsFromPayload($analytics['age_brackets'] ?? null);
    /** @var array<string, int> $ageDistribution */
    $ageDistribution = mapCountsFromPayload($analytics['age_group_distribution'] ?? null);
    /** @var array<string, mixed> $socioEconomic */
    $socioEconomic = normalizeAssocArray($analytics['socio_economic'] ?? null);
    /** @var array<string, mixed> $housingUtilities */
    $housingUtilities = normalizeAssocArray($analytics['housing_utilities'] ?? null);
    $hasAnalytics = !empty($populationSummary) || !empty($ageBrackets) || !empty($ageDistribution) || !empty($socioEconomic) || !empty($housingUtilities);
    if (!$hasAnalytics) {
        return null;
    }

    /** @var array<string, int> $employment */
    $employment = mapCountsFromPayload($socioEconomic['employment_status'] ?? null);
    /** @var array<string, int> $education */
    $education = mapCountsFromPayload($socioEconomic['educational_attainment'] ?? null);
    /** @var array<string, int> $civilStatus */
    $civilStatus = mapCountsFromPayload($analytics['civil_status_distribution'] ?? null);
    /** @var array<string, int> $otherIndicators */
    $otherIndicators = mapCountsFromPayload($socioEconomic['other_indicators'] ?? null);

    /** @var array<string, int> $toilet */
    $toilet = mapCountsFromPayload($housingUtilities['toilet_type'] ?? null);
    /** @var array<string, int> $water */
    $water = mapCountsFromPayload($housingUtilities['water_source'] ?? null);
    /** @var array<string, int> $electricity */
    $electricity = mapCountsFromPayload($housingUtilities['electricity_source'] ?? null);
    /** @var array<string, int> $ownership */
    $ownership = mapCountsFromPayload($housingUtilities['housing_ownership'] ?? null);

    $population = payloadCount($populationSummary, ['total_population', 'total', 'population'], 0);
    $male = payloadCount($populationSummary, ['male'], 0);
    $female = payloadCount($populationSummary, ['female'], 0);
    $households = payloadCount($populationSummary, ['households', 'total_households'], 0);
    $avgHousehold = payloadFloat($populationSummary, ['average_household_size', 'avg_household_size'], 0.0);

    /** @var array{
     *     population:int,
     *     male:int,
     *     female:int,
     *     households:int,
     *     avg_household:float,
     *     age_brackets:array<string,int>,
     *     ages:array<string,int>,
     *     employment:array<string,int>,
     *     education:array<string,int>,
     *     marital:array<string,int>,
     *     other_indicators:array<string,int>,
     *     toilet:array<string,int>,
     *     water:array<string,int>,
     *     electricity:array<string,int>,
     *     ownership:array<string,int>
     * } $metricsPayload
     */
    $metricsPayload = [
        'population' => $population,
        'male' => $male,
        'female' => $female,
        'households' => $households,
        'avg_household' => $avgHousehold,
        'age_brackets' => [
            '0-5' => payloadCount($ageBrackets, ['0-5', 'age_0_5'], 0),
            '6-10' => payloadCount($ageBrackets, ['6-10', 'age_6_10'], 0),
            '11-15' => payloadCount($ageBrackets, ['11-15', 'age_11_15'], 0),
            '16-20' => payloadCount($ageBrackets, ['16-20', 'age_16_20'], 0),
            '21-30' => payloadCount($ageBrackets, ['21-30', 'age_21_30'], 0),
            '31-40' => payloadCount($ageBrackets, ['31-40', 'age_31_40'], 0),
            '41-50' => payloadCount($ageBrackets, ['41-50', 'age_41_50'], 0),
            '51-60' => payloadCount($ageBrackets, ['51-60', 'age_51_60'], 0),
            '61-70' => payloadCount($ageBrackets, ['61-70', 'age_61_70'], 0),
            '71+' => payloadCount($ageBrackets, ['71+', 'age_71_plus'], 0),
        ],
        'ages' => [
            '0-5' => payloadCount($ageDistribution, ['0-5', 'age_0_5'], 0),
            '6-12' => payloadCount($ageDistribution, ['6-12', 'age_6_12'], 0),
            '13-17' => payloadCount($ageDistribution, ['13-17', 'age_13_17'], 0),
            '18-59' => payloadCount($ageDistribution, ['18-59', 'age_18_59'], 0),
            '60+' => payloadCount($ageDistribution, ['60+', 'age_60_plus'], 0),
        ],
        'employment' => $employment,
        'education' => $education,
        'marital' => $civilStatus,
        'other_indicators' => [
            'PWD' => payloadCount($otherIndicators, ['PWD', 'pwd'], 0),
            'Senior Citizens' => payloadCount($otherIndicators, ['Senior Citizens', 'senior_citizens'], 0),
            'Solo Parents' => payloadCount($otherIndicators, ['Solo Parents', 'solo_parents'], 0),
        ],
        'toilet' => $toilet,
        'water' => $water,
        'electricity' => $electricity,
        'ownership' => $ownership,
    ];

    return buildOfficeReportData($year, $profile, $metricsPayload);
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

function ensurePdfSpace(
    FPDF $pdf,
    float $height,
    string $watermarkImagePath = '',
    float $bottomPadding = 8.0
): void
{
    if ($pdf->GetY() + $height > $pdf->GetPageHeight() - $bottomPadding) {
        $pdf->AddPage();
        drawFpdfWatermark($pdf, $watermarkImagePath);
    }
}

/**
 * @param array<int, float> $widths
 * @param array<int, string> $cells
 */
function drawFpdfRow(
    FPDF $pdf,
    array $widths,
    array $cells,
    bool $header = false,
    string $watermarkImagePath = '',
    float $lineHeight = 4.3,
    float $minRowHeight = 6.5,
    float $bottomPadding = 8.0,
    ?float $startX = null
): void
{
    $lineCounts = [];
    foreach ($widths as $index => $width) {
        $value = text($cells[$index] ?? '-', 280);
        $lineCounts[] = pdfLineCount($pdf, max(1.0, $width - 3), $value);
    }
    $rowHeight = max($lineHeight * max($lineCounts ?: [1]), $minRowHeight);
    ensurePdfSpace($pdf, $rowHeight + 1, $watermarkImagePath, $bottomPadding);
    if ($startX !== null) {
        $pdf->SetX($startX);
    }
    $x = $pdf->GetX();
    $y = $pdf->GetY();

    $cursorX = $x;
    foreach ($widths as $width) {
        $pdf->Rect($cursorX, $y, $width, $rowHeight);
        $cursorX += $width;
    }

    $cursorX = $x;
    foreach ($widths as $index => $width) {
        $pdf->SetXY($cursorX + 1.5, $y + 1.3);
        $align = $index === 0 ? 'L' : 'C';
        $pdf->MultiCell($width - 3, $lineHeight, toPdfText(text($cells[$index] ?? '-', 280)), 0, $align);
        $cursorX += $width;
    }
    $pdf->SetXY($x, $y + $rowHeight);
}

/**
 * @return array<int, float>
 */
function reportTableColumnWidths(int $columnCount, float $usableWidth = 184.0): array
{
    $usableWidth = max(120.0, $usableWidth);
    if ($columnCount <= 1) {
        return [$usableWidth];
    }
    if ($columnCount === 2) {
        $countWidth = round($usableWidth * (66.0 / 184.0), 2);
        return [$usableWidth - $countWidth, $countWidth];
    }
    if ($columnCount === 3) {
        $metricWidth = round($usableWidth * (38.0 / 184.0), 2);
        return [$usableWidth - ($metricWidth * 2.0), $metricWidth, $metricWidth];
    }

    $firstColumn = $usableWidth * (96.0 / 184.0);
    $remainingColumns = max(1, $columnCount - 1);
    $remainingWidth = max(40.0, $usableWidth - $firstColumn);
    $perColumn = $remainingWidth / $remainingColumns;

    $widths = [$firstColumn];
    for ($i = 0; $i < $remainingColumns; $i++) {
        $widths[] = $perColumn;
    }
    return $widths;
}

/**
 * @param array<string, mixed> $report
 * @param array<string, string> $profile
 */
function renderReportWithFpdf(array $report, string $officialSealPath = '', array $profile = []): string
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
    if (!class_exists('ReportFpdf', false)) {
        class ReportFpdf extends FPDF
        {
            /** @var array<int, array{params: array{ca: float, CA: float, BM: string}, n?: int}> */
            protected $extgstates = [];

            public function SetAlpha(float $alpha, string $blendMode = 'Normal'): void
            {
                $alpha = max(0.0, min(1.0, $alpha));
                $stateId = $this->addExtGState([
                    'ca' => $alpha,
                    'CA' => $alpha,
                    'BM' => '/' . $blendMode,
                ]);
                $this->setExtGState($stateId);
            }

            /**
             * @param array{ca: float, CA: float, BM: string} $params
             */
            protected function addExtGState(array $params): int
            {
                $stateId = count($this->extgstates) + 1;
                $this->extgstates[$stateId] = ['params' => $params];
                return $stateId;
            }

            protected function setExtGState(int $stateId): void
            {
                $this->_out(sprintf('/GS%d gs', $stateId));
            }

            protected function _putextgstates(): void
            {
                foreach ($this->extgstates as $stateId => $state) {
                    $this->_newobj();
                    $this->extgstates[$stateId]['n'] = $this->n;
                    $this->_put('<</Type /ExtGState');
                    $this->_put(sprintf('/ca %.3F', (float) ($state['params']['ca'] ?? 1.0)));
                    $this->_put(sprintf('/CA %.3F', (float) ($state['params']['CA'] ?? 1.0)));
                    $this->_put('/BM ' . (string) ($state['params']['BM'] ?? '/Normal'));
                    $this->_put('>>');
                    $this->_put('endobj');
                }
            }

            protected function _putresourcedict(): void
            {
                parent::_putresourcedict();
                if (!$this->extgstates) {
                    return;
                }

                $this->_put('/ExtGState <<');
                foreach ($this->extgstates as $stateId => $state) {
                    $this->_put('/GS' . $stateId . ' ' . (int) ($state['n'] ?? 0) . ' 0 R');
                }
                $this->_put('>>');
            }

            protected function _putresources(): void
            {
                if ($this->extgstates) {
                    $this->_putextgstates();
                }
                parent::_putresources();
            }

            public function PageCount(): int
            {
                return (int) $this->page;
            }
        }
    }

    $watermarkAsset = prepareFpdfWatermarkImage($officialSealPath);
    $watermarkPath = $watermarkAsset['path'] ?? '';
    $watermarkIsTemp = !empty($watermarkAsset['is_temp']);
    $footerData = reportFooterData($profile, $report);
    $headerLines = normalizeReportHeaderLines($report['header_lines'] ?? null);
    $reportTitle = text($report['title'] ?? '', 220);
    $sections = normalizeReportSections($report['sections'] ?? null);

    $scales = [1.0, 0.94, 0.88, 0.82, 0.76, 0.70, 0.64, 0.58, 0.52];
    $binary = '';
    $bestBinary = '';
    $bestPageCount = PHP_INT_MAX;
    $renderError = '';

    foreach ($scales as $scale) {
        $marginLeft = max(7.0, 14.0 * $scale);
        $marginTop = max(6.0, 10.0 * $scale);
        $marginRight = max(7.0, 14.0 * $scale);
        $bottomMargin = max(6.0, 10.0 * $scale);
        $bottomPadding = max(4.2, 8.0 * $scale);
        $logoSize = max(14.0, 21.0 * $scale);
        $logoY = max(5.2, 8.5 * $scale);
        $headerY = max(7.0, 11.0 * $scale);
        $headerLineHeight = max(2.8, 4.6 * $scale);
        $headerFontSize = max(7.2, 10.0 * $scale);
        $afterHeaderGap = max(0.6, 1.4 * $scale);
        $titleFontSize = max(9.0, 12.5 * $scale);
        $titleHeight = max(4.0, 6.0 * $scale);
        $afterTitleGap = max(0.8, 2.5 * $scale);
        $sectionHeadingCheck = max(3.8, 7.0 * $scale);
        $sectionFontSize = max(7.3, 10.0 * $scale);
        $sectionHeight = max(3.1, 5.0 * $scale);
        $tableTitleCheck = max(3.2, 6.0 * $scale);
        $tableTitleFont = max(7.0, 9.5 * $scale);
        $tableTitleHeight = max(2.9, 4.5 * $scale);
        $tableHeaderFont = max(6.9, 9.3 * $scale);
        $tableBodyFont = max(6.8, 9.2 * $scale);
        $rowLineHeight = max(2.6, 4.3 * $scale);
        $rowMinHeight = max(3.9, 6.5 * $scale);
        $rowGapAfterTable = max(0.4, 1.3 * $scale);
        $underlineLeft = max(20.0, 35.0 * $scale);
        $underlineRight = min(192.0, 181.0 + ((1.0 - $scale) * 7.0));

        try {
            $pdf = new ReportFpdf('P', 'mm', 'Letter');
            $pdf->SetMargins($marginLeft, $marginTop, $marginRight);
            $pdf->SetAutoPageBreak(true, $bottomMargin);
            $pdf->AddPage();
            drawFpdfWatermark($pdf, $watermarkPath);

            $leftLogo = __DIR__ . '/assets/img/barangay-cabarian-logo.png';
            $rightLogo = __DIR__ . '/assets/img/ligao-city-logo.png';
            // Keep side spacing while scaling logo size.
            $leftLogoX = 22.0;
            $rightLogoX = $pdf->GetPageWidth() - 22.0 - $logoSize;
            if (is_file($leftLogo)) {
                $pdf->Image($leftLogo, $leftLogoX, $logoY, $logoSize, $logoSize);
            }
            if (is_file($rightLogo)) {
                $pdf->Image($rightLogo, $rightLogoX, $logoY, $logoSize, $logoSize);
            }

            $pdf->SetY($headerY);
            foreach ($headerLines as $line) {
                $pdf->SetFont('Times', '', $headerFontSize);
                $pdf->Cell(0, $headerLineHeight, toPdfText($line), 0, 1, 'C');
            }

            // Keep report tables inside the same visual gutter as the side logos.
            $tableLeftX = 22.0;
            $tableRightX = 192.0;
            $tableWidth = max(120.0, $tableRightX - $tableLeftX);

            $pdf->Ln($afterHeaderGap);
            $pdf->SetFont('Times', 'B', $titleFontSize);
            $pdf->Cell(0, $titleHeight, toPdfText($reportTitle), 0, 1, 'C');
            $lineY = $pdf->GetY();
            $pdf->Line($underlineLeft, $lineY, $underlineRight, $lineY);
            $pdf->Ln($afterTitleGap);

            foreach ($sections as $section) {
                ensurePdfSpace($pdf, $sectionHeadingCheck, $watermarkPath, $bottomPadding);
                $pdf->SetFont('Times', 'B', $sectionFontSize);
                $pdf->SetX($tableLeftX);
                $pdf->Cell($tableWidth, $sectionHeight, toPdfText($section['title']), 0, 1, 'L');
                foreach ($section['tables'] as $table) {
                    if (!empty($table['title'])) {
                        ensurePdfSpace($pdf, $tableTitleCheck, $watermarkPath, $bottomPadding);
                        $pdf->SetFont('Times', 'B', $tableTitleFont);
                        $pdf->SetX($tableLeftX);
                        $pdf->Cell($tableWidth, $tableTitleHeight, toPdfText($table['title']), 0, 1, 'L');
                    }
                    $columns = $table['columns'];
                    $widths = reportTableColumnWidths(count($columns), $tableWidth);
                    $showHeader = $table['show_header'];
                    if ($showHeader) {
                        $pdf->SetFont('Times', 'B', $tableHeaderFont);
                        $headerCells = [];
                        foreach ($columns as $column) {
                            $headerCells[] = text($column, 120);
                        }
                        drawFpdfRow(
                            $pdf,
                            $widths,
                            $headerCells,
                            true,
                            $watermarkPath,
                            $rowLineHeight,
                            $rowMinHeight,
                            $bottomPadding,
                            $tableLeftX
                        );
                    }
                    $pdf->SetFont('Times', '', $tableBodyFont);
                    foreach ($table['rows'] as $row) {
                        $rowCells = [];
                        foreach ($columns as $index => $column) {
                            $rowCells[] = text($row[$index] ?? '-', 280);
                        }
                        drawFpdfRow(
                            $pdf,
                            $widths,
                            $rowCells,
                            false,
                            $watermarkPath,
                            $rowLineHeight,
                            $rowMinHeight,
                            $bottomPadding,
                            $tableLeftX
                        );
                    }
                    $pdf->Ln($rowGapAfterTable);
                }
            }

            drawFpdfSignatureFooter($pdf, $footerData, $watermarkPath, $scale, $bottomPadding);

            $candidateBinary = $pdf->Output('S');
            if (!is_string($candidateBinary) || $candidateBinary === '') {
                continue;
            }

            $pageCount = $pdf->PageCount();
            if ($pageCount < $bestPageCount) {
                $bestPageCount = $pageCount;
                $bestBinary = $candidateBinary;
            }
            if ($pageCount <= 2) {
                $binary = $candidateBinary;
                break;
            }
        } catch (Throwable $exception) {
            $renderError = $exception->getMessage();
        }
    }

    if ($binary === '') {
        $binary = $bestBinary;
    }
    if ($watermarkIsTemp && $watermarkPath !== '' && is_file($watermarkPath)) {
        @unlink($watermarkPath);
    }
    if (!is_string($binary) || $binary === '') {
        if ($renderError !== '') {
            respondWithError(500, 'Failed to generate PDF output. ' . $renderError);
        }
        respondWithError(500, 'Failed to generate PDF output.');
    }
    return $binary;
}

/**
 * @param array<string, mixed> $report
 * @param array<string, string> $profile
 */
function buildPdfHtml(array $report, array $profile, string $sealDataUri = ''): string
{
    $footerData = reportFooterData($profile, $report);
    $headerLines = normalizeReportHeaderLines($report['header_lines'] ?? null);
    $reportTitle = text($report['title'] ?? '', 220);
    $sections = normalizeReportSections($report['sections'] ?? null);
    $html = '<!doctype html><html><head><meta charset="utf-8"><style>';
    $html .= '@page{size:letter;margin:0.45in;}';
    $html .= 'body{font-family:"Times New Roman",serif;font-size:10.5px;color:#101010;margin:0;}';
    $html .= '.watermark{position:fixed;left:0.75in;top:2.0in;width:7.0in;opacity:0.10;}';
    $html .= '.watermark img{display:block;width:100%;height:auto;}';
    $html .= '.center{text-align:center;}.line{margin:0;line-height:1.22;}';
    $html .= '.title{font-size:16px;font-weight:700;margin:2px 0 1px;border-bottom:1px solid #000;padding-bottom:2px;}';
    $html .= '.section{margin-top:6px;page-break-inside:avoid;}.section-title{font-size:12px;font-weight:700;margin:0 0 2px;}';
    $html .= '.table-title{font-size:10.5px;font-weight:700;margin:5px 0 2px;}';
    $html .= 'table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 4px;}';
    $html .= 'th,td{border:1px solid #1e1e1e;padding:3px 5px;vertical-align:top;}';
    $html .= 'th{font-weight:700;text-align:left;}';
    $html .= 'th.metric,td.metric{text-align:center;}';
    $html .= 'td{line-height:1.2;}';
    $html .= '.report-footer{margin-top:10px;page-break-inside:avoid;}';
    $html .= '.sig-row{overflow:hidden;}';
    $html .= '.sig-col{float:left;width:42%;text-align:center;}';
    $html .= '.sig-col.right{float:right;}';
    $html .= '.sig-name{margin:0;font-size:11px;font-weight:700;}';
    $html .= '.sig-title{margin:2px 0 0;font-size:10px;}';
    $html .= '.sig-date{margin:15px 0 0;text-align:center;font-size:10px;}';
    $html .= '</style></head><body>';
    if ($sealDataUri !== '') {
        $html .= '<div class="watermark"><img src="' . esc($sealDataUri) . '" alt=""></div>';
    }
    foreach ($headerLines as $line) {
        $html .= '<p class="line center">' . esc($line) . '</p>';
    }
    $html .= '<p class="title center">' . esc($reportTitle) . '</p>';
    foreach ($sections as $section) {
        $html .= '<div class="section"><p class="section-title">' . esc($section['title']) . '</p>';
        foreach ($section['tables'] as $table) {
            if (!empty($table['title'])) {
                $html .= '<p class="table-title">' . esc($table['title']) . '</p>';
            }
            $columns = $table['columns'];
            $showHeader = $table['show_header'];
            $html .= '<table>';
            if ($showHeader) {
                $html .= '<thead><tr>';
                foreach ($columns as $index => $columnName) {
                    $class = $index === 0 ? '' : ' class="metric"';
                    $html .= '<th' . $class . '>' . esc($columnName) . '</th>';
                }
                $html .= '</tr></thead>';
            }
            $html .= '<tbody>';
            foreach ($table['rows'] as $row) {
                $html .= '<tr>';
                foreach ($columns as $index => $columnName) {
                    $class = $index === 0 ? '' : ' class="metric"';
                    $value = text($row[$index] ?? '-', 280);
                    $html .= '<td' . $class . '>' . esc($value) . '</td>';
                }
                $html .= '</tr>';
            }
            $html .= '</tbody></table>';
        }
        $html .= '</div>';
    }

    $html .= '<div class="report-footer">';
    $html .= '<div class="sig-row">';
    $html .= '<div class="sig-col"><p class="sig-name">' . esc($footerData['captain']) . '</p><p class="sig-title">Brgy Captain</p></div>';
    $html .= '<div class="sig-col right"><p class="sig-name">' . esc($footerData['secretary']) . '</p><p class="sig-title">Secretary</p></div>';
    $html .= '</div>';
    $html .= '<p class="sig-date">' . esc($footerData['date_generated']) . '</p>';
    $html .= '</div>';

    $html .= '</body></html>';
    return $html;
}

/**
 * @param array<string, mixed> $report
 * @param array<string, string> $profile
 */
function outputPdf(array $report, array $profile): void
{
    $binary = '';
    $sealAbsolutePath = reportOfficialSealAbsolutePath($profile);
    $sealDataUri = reportOfficialSealDataUri($sealAbsolutePath);
    $dompdfClass = 'Dompdf\\Dompdf';
    $dompdfOptionsClass = 'Dompdf\\Options';
    if (class_exists($dompdfClass) && class_exists($dompdfOptionsClass)) {
        $opt = new $dompdfOptionsClass();
        $opt->set('isRemoteEnabled', false);
        $opt->set('isHtml5ParserEnabled', true);
        $dompdf = new $dompdfClass($opt);
        $dompdf->loadHtml(buildPdfHtml($report, $profile, $sealDataUri), 'UTF-8');
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();
        $binary = $dompdf->output();
    } else {
        $binary = renderReportWithFpdf($report, $sealAbsolutePath, $profile);
    }
    if (!is_string($binary) || $binary === '') {
        respondWithError(500, 'Failed to generate PDF output.');
    }
    $filename = reportFileName($profile, reportYearValue($report), 'pdf');
    clearOutputBuffers();
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($binary));
    echo $binary;
    exit;
}

function sheetColumnLetter(int $columnIndex): string
{
    $index = max(1, $columnIndex);
    $label = '';
    while ($index > 0) {
        $index--;
        $label = chr(65 + ($index % 26)) . $label;
        $index = (int) floor($index / 26);
    }
    return $label;
}

/**
 * @param array{
 *     title:string,
 *     columns:list<string>,
 *     show_header:bool,
 *     rows:list<list<string>>
 * } $table
 */
function renderSheetTable($sheet, int &$row, array $table, string $alignmentClass, string $borderClass): void
{
    $table = normalizeReportTable($table);
    $columns = $table['columns'];
    $columnCount = max(1, count($columns));
    $startColumn = 1;
    $endColumn = $startColumn + $columnCount - 1;
    $startLetter = sheetColumnLetter($startColumn);
    $endLetter = sheetColumnLetter($endColumn);

    if ($table['title'] !== '') {
        $sheet->setCellValue("{$startLetter}{$row}", $table['title']);
        $sheet->mergeCells("{$startLetter}{$row}:{$endLetter}{$row}");
        $sheet->getStyle("{$startLetter}{$row}:{$endLetter}{$row}")->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle("{$startLetter}{$row}:{$endLetter}{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        $row++;
    }

    $tableStart = $row;
    $showHeader = $table['show_header'];
    if ($showHeader) {
        foreach ($columns as $index => $columnLabel) {
            $columnLetter = sheetColumnLetter($startColumn + $index);
            $sheet->setCellValue("{$columnLetter}{$row}", text($columnLabel, 120));
        }
        $sheet->getStyle("{$startLetter}{$row}:{$endLetter}{$row}")->getFont()->setBold(true);
        $sheet->getStyle("{$startLetter}{$row}:{$endLetter}{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER)->setVertical($alignmentClass::VERTICAL_CENTER);
        $row++;
    }

    foreach ($table['rows'] as $entry) {
        foreach ($columns as $index => $columnLabel) {
            $columnLetter = sheetColumnLetter($startColumn + $index);
            $sheet->setCellValue("{$columnLetter}{$row}", text($entry[$index] ?? '-', 260));
        }
        $sheet->getStyle("{$startLetter}{$row}:{$endLetter}{$row}")->getAlignment()->setVertical($alignmentClass::VERTICAL_CENTER)->setWrapText(true);
        $sheet->getStyle("{$startLetter}{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        for ($colIndex = 1; $colIndex < $columnCount; $colIndex++) {
            $metricLetter = sheetColumnLetter($startColumn + $colIndex);
            $sheet->getStyle("{$metricLetter}{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
        }
        $row++;
    }

    $tableEnd = $row - 1;
    $sheet->getStyle("{$startLetter}{$tableStart}:{$endLetter}{$tableEnd}")->getBorders()->getAllBorders()->setBorderStyle($borderClass::BORDER_THIN);
    $row++;
}

/**
 * @param array<string, mixed> $report
 * @param array<string, string> $profile
 */
function outputSpreadsheet(
    array $report,
    array $profile,
    string $targetPath = 'php://output',
    bool $sendDownloadHeaders = true
): void {
    if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) {
        respondWithError(500, 'PhpSpreadsheet is not available. Run composer install first.');
    }

    $spreadsheet = new PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Annual Report');
    $sheet->getDefaultRowDimension()->setRowHeight(16);

    $alignmentClass = 'PhpOffice\\PhpSpreadsheet\\Style\\Alignment';
    $borderClass = 'PhpOffice\\PhpSpreadsheet\\Style\\Border';
    $drawingClass = 'PhpOffice\\PhpSpreadsheet\\Worksheet\\Drawing';
    $pageSetupClass = 'PhpOffice\\PhpSpreadsheet\\Worksheet\\PageSetup';
    $headerLines = normalizeReportHeaderLines($report['header_lines'] ?? null);
    $reportTitle = text($report['title'] ?? '', 220);
    $sections = normalizeReportSections($report['sections'] ?? null);
    $metaBlock = normalizeReportMetaBlock($report['meta_block'] ?? null);

    $row = 1;
    if (class_exists($drawingClass)) {
        $leftLogo = __DIR__ . '/assets/img/barangay-cabarian-logo.png';
        $rightLogo = __DIR__ . '/assets/img/ligao-city-logo.png';
        if (is_file($leftLogo)) {
            $logoLeft = new $drawingClass();
            $logoLeft->setName('Barangay Logo');
            $logoLeft->setDescription('Barangay Logo');
            $logoLeft->setPath($leftLogo);
            $logoLeft->setHeight(55);
            $logoLeft->setCoordinates('A1');
            $logoLeft->setWorksheet($sheet);
        }
        if (is_file($rightLogo)) {
            $logoRight = new $drawingClass();
            $logoRight->setName('City Logo');
            $logoRight->setDescription('City Logo');
            $logoRight->setPath($rightLogo);
            $logoRight->setHeight(55);
            $logoRight->setCoordinates('C1');
            $logoRight->setOffsetX(16);
            $logoRight->setWorksheet($sheet);
        }
    }

    foreach ($headerLines as $line) {
        $sheet->setCellValue("A{$row}", $line);
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setSize(11)->setName('Times New Roman');
        $row++;
    }

    $row += 1;
    $sheet->setCellValue("A{$row}", $reportTitle);
    $sheet->mergeCells("A{$row}:C{$row}");
    $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_CENTER);
    $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true)->setSize(14)->setName('Times New Roman');
    $sheet->getStyle("A{$row}:C{$row}")->getBorders()->getBottom()->setBorderStyle($borderClass::BORDER_MEDIUM);
    $row += 1;

    foreach ($sections as $section) {
        $sheet->setCellValue("A{$row}", $section['title']);
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true)->setSize(12)->setName('Times New Roman');
        $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        $row++;
        foreach ($section['tables'] as $table) {
            renderSheetTable($sheet, $row, $table, $alignmentClass, $borderClass);
        }
    }

    if (count($metaBlock) > 0) {
        $sheet->setCellValue("A{$row}", 'Report Certification and Metadata');
        $sheet->mergeCells("A{$row}:C{$row}");
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true)->setSize(11)->setName('Times New Roman');
        $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setHorizontal($alignmentClass::HORIZONTAL_LEFT);
        $row++;

        foreach ($metaBlock as $entry) {
            $label = $entry['label'];
            $value = $entry['value'];
            if ($label === '' && $value === '') {
                continue;
            }

            $sheet->setCellValue("A{$row}", $label . ':');
            $sheet->setCellValue("B{$row}", $value);
            $sheet->mergeCells("B{$row}:C{$row}");
            $sheet->getStyle("A{$row}")->getFont()->setBold(true);
            $sheet->getStyle("A{$row}:C{$row}")->getAlignment()->setVertical($alignmentClass::VERTICAL_CENTER)->setWrapText(true);
            $sheet->getStyle("A{$row}:C{$row}")->getBorders()->getAllBorders()->setBorderStyle($borderClass::BORDER_THIN);
            $row++;
        }
        $row++;
    }

    $sheet->getStyle('A1:C' . max(1, $row))->getFont()->setName('Times New Roman')->setSize(10.5);
    $sheet->getColumnDimension('A')->setWidth(62);
    $sheet->getColumnDimension('B')->setWidth(19);
    $sheet->getColumnDimension('C')->setWidth(19);
    $sheet->getPageMargins()->setTop(0.35)->setBottom(0.35)->setLeft(0.3)->setRight(0.3);
    $sheet->getPageSetup()->setOrientation($pageSetupClass::ORIENTATION_PORTRAIT);
    $sheet->getPageSetup()->setPaperSize($pageSetupClass::PAPERSIZE_LETTER);
    $sheet->getPageSetup()->setFitToPage(true);
    $sheet->getPageSetup()->setFitToWidth(1);
    $sheet->getPageSetup()->setFitToHeight(1);
    $sheet->getPageSetup()->setPrintArea('A1:C' . max(1, $row));

    $writer = new PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
    $filename = reportFileName($profile, reportYearValue($report), 'xlsx');
    if ($sendDownloadHeaders) {
        clearOutputBuffers();
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
    }
    $writer->save($targetPath);
    $spreadsheet->disconnectWorksheets();
    unset($spreadsheet);
    if ($sendDownloadHeaders) {
        exit;
    }
}

if (PHP_SAPI === 'cli') {
    $argvList = $_SERVER['argv'] ?? [];
    $mode = isset($argvList[1]) ? (string) $argvList[1] : '';
    if ($mode === '--excel-cli') {
        $inputFile = isset($argvList[2]) ? (string) $argvList[2] : '';
        $outputFile = isset($argvList[3]) ? (string) $argvList[3] : '';
        if ($inputFile === '' || !is_file($inputFile) || $outputFile === '') {
            fwrite(STDERR, "Invalid CLI Excel export arguments.\n");
            exit(2);
        }

        $raw = @file_get_contents($inputFile);
        if (!is_string($raw) || trim($raw) === '') {
            fwrite(STDERR, "Unable to read CLI Excel export payload.\n");
            exit(3);
        }

        $cliPayload = json_decode($raw, true);
        if (!is_array($cliPayload)) {
            fwrite(STDERR, "Invalid CLI Excel export payload.\n");
            exit(4);
        }

        $reportData = is_array($cliPayload['report'] ?? null) ? $cliPayload['report'] : null;
        $profileData = is_array($cliPayload['profile'] ?? null) ? $cliPayload['profile'] : null;
        if (!is_array($reportData) || !is_array($profileData)) {
            fwrite(STDERR, "Incomplete CLI Excel export payload.\n");
            exit(5);
        }

        $autoload = __DIR__ . '/vendor/autoload.php';
        if (!is_file($autoload)) {
            fwrite(STDERR, "Excel dependencies are missing.\n");
            exit(6);
        }
        require_once $autoload;

        try {
            outputSpreadsheet($reportData, $profileData, $outputFile, false);
        } catch (Throwable $exception) {
            fwrite(STDERR, 'Excel CLI export failed: ' . $exception->getMessage() . "\n");
            exit(7);
        }
        exit(0);
    }
}

$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$origin = text($_SERVER['HTTP_ORIGIN'] ?? '', 300);
$allowedOrigins = envList(['REPORT_EXPORT_ALLOWED_ORIGINS', 'EXPORT_ALLOWED_ORIGINS', 'CORS_ALLOWED_ORIGINS']);
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-CSRF-Token');
}
if ($requestMethod === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($requestMethod !== 'POST') {
    header('Allow: POST');
    respondWithError(405, 'Method not allowed. Use POST.');
}

if (PHP_SAPI !== 'cli') {
    $csrfToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!auth_csrf_valid($csrfToken)) {
        respondWithError(419, 'Invalid CSRF token.');
    }
}

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
if (!is_array($analyticsPayload)) {
    respondWithError(400, 'Analytics payload is required for report export.');
}
$payloadYear = parseSelectedYear($analyticsPayload['year'] ?? null);
if ($payloadYear !== $year) {
    respondWithError(422, 'Analytics data is outdated for the selected year. Refresh the Reports page and export again.');
}
$profilePdo = dbConnection();
$profile = reportProfileData($profilePdo);
$report = buildAnnualReportDataFromAnalytics($analyticsPayload, $year, $profile);
if (!is_array($report)) {
    respondWithError(422, 'Analytics payload is incomplete for report export.');
}

if ($format === 'pdf') {
    outputPdf($report, $profile);
}

if ($format === 'xlsx' && PHP_VERSION_ID < 80300) {
    $excelPhpBinary = findExcelCliPhpBinary();
    if (is_string($excelPhpBinary) && $excelPhpBinary !== '') {
        $externalError = '';
        $generatedFile = exportSpreadsheetUsingExternalPhp($report, $profile, $excelPhpBinary, $externalError);
        if (is_string($generatedFile) && is_file($generatedFile)) {
            $filename = reportFileName($profile, reportYearValue($report), 'xlsx');
            clearOutputBuffers();
            header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Cache-Control: max-age=0');
            $length = (int) @filesize($generatedFile);
            if ($length > 0) {
                header('Content-Length: ' . (string) $length);
            }
            readfile($generatedFile);
            @unlink($generatedFile);
            exit;
        }
    }
}

$autoload = __DIR__ . '/vendor/autoload.php';
if (!is_file($autoload)) {
    respondWithError(500, 'Excel export dependencies are missing. Run: composer install');
}
try {
    require_once $autoload;
} catch (Throwable $exception) {
    respondWithError(
        500,
        'Excel export is unavailable on this server setup (current PHP ' . PHP_VERSION
        . '). Install dependencies compatible with your PHP version or upgrade PHP to 8.3+.'
    );
}
outputSpreadsheet($report, $profile);
