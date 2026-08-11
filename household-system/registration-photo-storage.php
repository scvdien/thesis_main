<?php
declare(strict_types=1);

const REG_PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const REG_PHOTO_MAX_STORED_BYTES = 1024 * 1024;
const REG_PHOTO_MAX_SOURCE_DIMENSION = 6000;
const REG_PHOTO_MAX_SOURCE_PIXELS = 25000000;
const REG_PHOTO_MAX_OUTPUT_DIMENSION = 1280;

function reg_photo_bootstrap_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `registration_photos` (
            `photo_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            `subject_type` VARCHAR(16) NOT NULL,
            `household_code` VARCHAR(64) NOT NULL DEFAULT "",
            `storage_key` VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            `mime_type` VARCHAR(32) NOT NULL DEFAULT "image/jpeg",
            `size_bytes` INT UNSIGNED NOT NULL DEFAULT 0,
            `width` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `height` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            `sha256` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            `state` VARCHAR(16) NOT NULL DEFAULT "staged",
            `created_by_user_id` BIGINT UNSIGNED NULL,
            `attached_at` DATETIME NULL,
            `deleted_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`photo_id`),
            KEY `idx_registration_photos_household` (`household_code`),
            KEY `idx_registration_photos_state_created` (`state`, `created_at`),
            KEY `idx_registration_photos_created_by` (`created_by_user_id`),
            KEY `idx_registration_photos_sha256` (`sha256`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function reg_photo_normalize_id(mixed $value, bool $allowEmpty = true): string
{
    $photoId = strtolower(trim((string) $value));
    if ($photoId === '' && $allowEmpty) {
        return '';
    }
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $photoId) !== 1) {
        throw new InvalidArgumentException('Invalid photo reference. Please capture the photo again.');
    }
    return $photoId;
}

function reg_photo_normalize_subject_type(mixed $value): string
{
    $subjectType = strtolower(trim((string) $value));
    if (!in_array($subjectType, ['household', 'head', 'member'], true)) {
        throw new InvalidArgumentException('Invalid photo subject type.');
    }
    return $subjectType;
}

function reg_photo_public_url(string $photoId): string
{
    return 'registration-photo.php?id=' . rawurlencode(reg_photo_normalize_id($photoId, false));
}

function reg_photo_normalized_path(string $path): string
{
    $normalized = str_replace('\\', '/', $path);
    $normalized = rtrim($normalized, '/');
    return DIRECTORY_SEPARATOR === '\\' ? strtolower($normalized) : $normalized;
}

function reg_photo_path_is_inside(string $path, string $parent): bool
{
    $normalizedPath = reg_photo_normalized_path($path);
    $normalizedParent = reg_photo_normalized_path($parent);
    return $normalizedPath === $normalizedParent
        || str_starts_with($normalizedPath . '/', $normalizedParent . '/');
}

function reg_photo_storage_directory(): string
{
    static $resolvedDirectory = null;
    if (is_string($resolvedDirectory) && $resolvedDirectory !== '') {
        return $resolvedDirectory;
    }

    $configuredDirectory = function_exists('auth_env')
        ? trim(auth_env(['HIMS_REGISTRATION_PHOTO_STORAGE_DIR'], ''))
        : '';
    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));

    if ($configuredDirectory !== '') {
        $candidate = $configuredDirectory;
    } elseif (is_string($documentRoot) && $documentRoot !== '') {
        $candidate = dirname($documentRoot) . DIRECTORY_SEPARATOR . 'hims-private' . DIRECTORY_SEPARATOR . 'registration-photos';
    } else {
        // Registration photos are permanent records. Never put them in the
        // operating system's temporary directory, where routine cleanup could
        // silently remove files that are still referenced by a household.
        throw new RuntimeException('Private photo storage is unavailable.');
    }

    if (!is_dir($candidate) && !@mkdir($candidate, 0750, true) && !is_dir($candidate)) {
        throw new RuntimeException('Private photo storage is unavailable.');
    }

    $realCandidate = realpath($candidate);
    if (!is_string($realCandidate) || $realCandidate === '') {
        throw new RuntimeException('Private photo storage path could not be resolved.');
    }
    if (is_string($documentRoot) && $documentRoot !== '' && reg_photo_path_is_inside($realCandidate, $documentRoot)) {
        throw new RuntimeException('Private photo storage must be outside the public web directory.');
    }
    if (!is_writable($realCandidate)) {
        throw new RuntimeException('Private photo storage is not writable.');
    }

    $resolvedDirectory = $realCandidate;
    return $resolvedDirectory;
}

function reg_photo_storage_path(string $storageKey): string
{
    $safeKey = basename(trim($storageKey));
    if (preg_match('/^[0-9a-f]{48}\.jpg$/D', $safeKey) !== 1) {
        throw new RuntimeException('Invalid private photo storage key.');
    }
    return reg_photo_storage_directory() . DIRECTORY_SEPARATOR . $safeKey;
}

function reg_photo_apply_orientation(GdImage $image, int $orientation): GdImage
{
    $result = $image;
    if ($orientation === 2 && function_exists('imageflip')) {
        imageflip($result, IMG_FLIP_HORIZONTAL);
    } elseif ($orientation === 3) {
        $rotated = imagerotate($result, 180, 0);
        if ($rotated instanceof GdImage) $result = $rotated;
    } elseif ($orientation === 4 && function_exists('imageflip')) {
        imageflip($result, IMG_FLIP_VERTICAL);
    } elseif ($orientation === 5) {
        if (function_exists('imageflip')) imageflip($result, IMG_FLIP_HORIZONTAL);
        $rotated = imagerotate($result, -90, 0);
        if ($rotated instanceof GdImage) $result = $rotated;
    } elseif ($orientation === 6) {
        $rotated = imagerotate($result, -90, 0);
        if ($rotated instanceof GdImage) $result = $rotated;
    } elseif ($orientation === 7) {
        if (function_exists('imageflip')) imageflip($result, IMG_FLIP_HORIZONTAL);
        $rotated = imagerotate($result, 90, 0);
        if ($rotated instanceof GdImage) $result = $rotated;
    } elseif ($orientation === 8) {
        $rotated = imagerotate($result, 90, 0);
        if ($rotated instanceof GdImage) $result = $rotated;
    }
    return $result;
}

/**
 * @param array<string, mixed> $upload
 * @return array<string, mixed>
 */
function reg_photo_store_upload(array $upload): array
{
    $uploadError = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException('Photo upload failed. Please try again.');
    }

    $temporaryPath = (string) ($upload['tmp_name'] ?? '');
    if ($temporaryPath === '' || !is_uploaded_file($temporaryPath)) {
        throw new InvalidArgumentException('Invalid photo upload.');
    }
    $sourceSize = (int) (@filesize($temporaryPath) ?: 0);
    if ($sourceSize <= 0 || $sourceSize > REG_PHOTO_MAX_UPLOAD_BYTES) {
        throw new InvalidArgumentException('Photo must be smaller than 5 MB.');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detectedMime = strtolower((string) $finfo->file($temporaryPath));
    if (!in_array($detectedMime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        throw new InvalidArgumentException('Only JPEG, PNG, and WebP photos are allowed.');
    }

    $dimensions = @getimagesize($temporaryPath);
    $sourceWidth = is_array($dimensions) ? (int) ($dimensions[0] ?? 0) : 0;
    $sourceHeight = is_array($dimensions) ? (int) ($dimensions[1] ?? 0) : 0;
    if ($sourceWidth <= 0 || $sourceHeight <= 0) {
        throw new InvalidArgumentException('The uploaded file is not a valid image.');
    }
    if (
        $sourceWidth > REG_PHOTO_MAX_SOURCE_DIMENSION
        || $sourceHeight > REG_PHOTO_MAX_SOURCE_DIMENSION
        || ($sourceWidth * $sourceHeight) > REG_PHOTO_MAX_SOURCE_PIXELS
    ) {
        throw new InvalidArgumentException('Photo dimensions are too large.');
    }

    $binary = @file_get_contents($temporaryPath);
    $sourceImage = is_string($binary) ? @imagecreatefromstring($binary) : false;
    if (!$sourceImage instanceof GdImage) {
        throw new InvalidArgumentException('The uploaded image could not be decoded.');
    }

    $orientation = 1;
    if ($detectedMime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($temporaryPath, 'IFD0', true, false);
        if (is_array($exif)) {
            $orientation = (int) ($exif['IFD0']['Orientation'] ?? $exif['Orientation'] ?? 1);
        }
    }
    $orientedImage = reg_photo_apply_orientation($sourceImage, $orientation);
    $orientedWidth = imagesx($orientedImage);
    $orientedHeight = imagesy($orientedImage);
    $scale = min(1, REG_PHOTO_MAX_OUTPUT_DIMENSION / max($orientedWidth, $orientedHeight));
    $outputWidth = max(1, (int) round($orientedWidth * $scale));
    $outputHeight = max(1, (int) round($orientedHeight * $scale));
    $outputImage = imagecreatetruecolor($outputWidth, $outputHeight);
    if (!$outputImage instanceof GdImage) {
        imagedestroy($orientedImage);
        throw new RuntimeException('Unable to allocate photo processing memory.');
    }
    $white = imagecolorallocate($outputImage, 255, 255, 255);
    imagefill($outputImage, 0, 0, $white);
    imagecopyresampled(
        $outputImage,
        $orientedImage,
        0,
        0,
        0,
        0,
        $outputWidth,
        $outputHeight,
        $orientedWidth,
        $orientedHeight
    );

    $directory = reg_photo_storage_directory();
    $storageKey = bin2hex(random_bytes(24)) . '.jpg';
    $finalPath = reg_photo_storage_path($storageKey);
    $tempOutputPath = $directory . DIRECTORY_SEPARATOR . '.' . bin2hex(random_bytes(16)) . '.tmp';

    $written = @imagejpeg($outputImage, $tempOutputPath, 80);
    imagedestroy($outputImage);
    if ($orientedImage !== $sourceImage) {
        imagedestroy($sourceImage);
    }
    imagedestroy($orientedImage);
    if (!$written || !is_file($tempOutputPath)) {
        @unlink($tempOutputPath);
        throw new RuntimeException('Unable to save the processed photo.');
    }

    $storedSize = (int) (@filesize($tempOutputPath) ?: 0);
    if ($storedSize > REG_PHOTO_MAX_STORED_BYTES) {
        $retryImage = @imagecreatefromjpeg($tempOutputPath);
        if ($retryImage instanceof GdImage) {
            @imagejpeg($retryImage, $tempOutputPath, 66);
            imagedestroy($retryImage);
            clearstatcache(true, $tempOutputPath);
            $storedSize = (int) (@filesize($tempOutputPath) ?: 0);
        }
    }
    if ($storedSize <= 0 || $storedSize > REG_PHOTO_MAX_STORED_BYTES) {
        @unlink($tempOutputPath);
        throw new InvalidArgumentException('Processed photo is still too large. Please use another image.');
    }

    if (!@rename($tempOutputPath, $finalPath)) {
        @unlink($tempOutputPath);
        throw new RuntimeException('Unable to finalize the processed photo.');
    }
    @chmod($finalPath, 0640);

    return [
        'storage_key' => $storageKey,
        'mime_type' => 'image/jpeg',
        'size_bytes' => $storedSize,
        'width' => $outputWidth,
        'height' => $outputHeight,
        'sha256' => (string) hash_file('sha256', $finalPath),
    ];
}

function reg_photo_delete_storage_key(string $storageKey): bool
{
    try {
        $path = reg_photo_storage_path($storageKey);
    } catch (Throwable $exception) {
        return false;
    }

    if (!is_file($path)) {
        return true;
    }

    return @unlink($path) && !is_file($path);
}

/**
 * @param array<string, string> $references Map of photo id to subject type.
 */
function reg_photo_attach_references(
    PDO $pdo,
    array $references,
    string $householdCode,
    int $actorUserId
): void {
    if ($references === []) {
        return;
    }

    foreach ($references as $photoIdValue => $subjectTypeValue) {
        $photoId = reg_photo_normalize_id($photoIdValue, false);
        $subjectType = reg_photo_normalize_subject_type($subjectTypeValue);
        $stmt = $pdo->prepare(
            'SELECT `photo_id`, `subject_type`, `household_code`, `state`, `created_by_user_id`, `deleted_at`
             FROM `registration_photos`
             WHERE `photo_id` = :photo_id
             LIMIT 1 FOR UPDATE'
        );
        $stmt->execute(['photo_id' => $photoId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row) || !empty($row['deleted_at'])) {
            throw new InvalidArgumentException('A selected photo is unavailable. Please capture it again.');
        }
        if ((string) ($row['subject_type'] ?? '') !== $subjectType) {
            throw new InvalidArgumentException('A photo was attached to the wrong profile type.');
        }

        $state = (string) ($row['state'] ?? '');
        $attachedHousehold = trim((string) ($row['household_code'] ?? ''));
        $creatorUserId = (int) ($row['created_by_user_id'] ?? 0);
        if ($state === 'attached' && $attachedHousehold !== $householdCode) {
            throw new InvalidArgumentException('A photo is already attached to another household.');
        }
        if ($state !== 'attached' && $actorUserId > 0 && $creatorUserId !== $actorUserId) {
            throw new InvalidArgumentException('A staged photo belongs to another user.');
        }

        $update = $pdo->prepare(
            'UPDATE `registration_photos`
             SET `state` = "attached", `household_code` = :household_code,
                 `attached_at` = COALESCE(`attached_at`, CURRENT_TIMESTAMP), `updated_at` = CURRENT_TIMESTAMP
             WHERE `photo_id` = :photo_id LIMIT 1'
        );
        $update->execute([
            'household_code' => $householdCode,
            'photo_id' => $photoId,
        ]);
    }
}

/**
 * Mark photos that are no longer referenced by a photo-aware household update.
 * File removal is intentionally left to the caller after the DB transaction
 * commits, so a rollback can never leave a live record pointing to a missing
 * file.
 *
 * @param array<int, string> $retainedPhotoIds
 * @return array<int, string> Private storage keys that may be removed post-commit.
 */
function reg_photo_mark_unreferenced(
    PDO $pdo,
    string $householdCode,
    array $retainedPhotoIds
): array {
    $retained = [];
    foreach ($retainedPhotoIds as $photoIdValue) {
        $photoId = reg_photo_normalize_id($photoIdValue);
        if ($photoId !== '') {
            $retained[$photoId] = true;
        }
    }

    $stmt = $pdo->prepare(
        'SELECT `photo_id`, `storage_key`
         FROM `registration_photos`
         WHERE `household_code` = :household_code
           AND `state` = "attached"
           AND `deleted_at` IS NULL
         FOR UPDATE'
    );
    $stmt->execute(['household_code' => $householdCode]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if ($rows === []) {
        return [];
    }

    $markDeleted = $pdo->prepare(
        'UPDATE `registration_photos`
         SET `state` = "deleted", `deleted_at` = CURRENT_TIMESTAMP, `updated_at` = CURRENT_TIMESTAMP
         WHERE `photo_id` = :photo_id
           AND `household_code` = :household_code
           AND `state` = "attached"
           AND `deleted_at` IS NULL
         LIMIT 1'
    );
    $storageKeys = [];
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $photoId = reg_photo_normalize_id($row['photo_id'] ?? '');
        if ($photoId === '' || isset($retained[$photoId])) continue;
        $markDeleted->execute([
            'photo_id' => $photoId,
            'household_code' => $householdCode,
        ]);
        if ($markDeleted->rowCount() > 0) {
            $storageKey = trim((string) ($row['storage_key'] ?? ''));
            if ($storageKey !== '') $storageKeys[] = $storageKey;
        }
    }
    return array_values(array_unique($storageKeys));
}

/** @param array<int, string> $storageKeys */
function reg_photo_delete_storage_keys(array $storageKeys): void
{
    foreach (array_values(array_unique($storageKeys)) as $storageKey) {
        reg_photo_delete_storage_key((string) $storageKey);
    }
}

/**
 * @return array<int, string>
 */
function reg_photo_mark_household_deleted(PDO $pdo, string $householdCode): array
{
    $stmt = $pdo->prepare(
        'SELECT `storage_key` FROM `registration_photos`
         WHERE `household_code` = :household_code AND `deleted_at` IS NULL
         FOR UPDATE'
    );
    $stmt->execute(['household_code' => $householdCode]);
    $storageKeys = array_values(array_filter(array_map(
        static fn (mixed $value): string => trim((string) $value),
        $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []
    )));

    $deleteStmt = $pdo->prepare(
        'UPDATE `registration_photos`
         SET `state` = "deleted", `deleted_at` = CURRENT_TIMESTAMP, `updated_at` = CURRENT_TIMESTAMP
         WHERE `household_code` = :household_code AND `deleted_at` IS NULL'
    );
    $deleteStmt->execute(['household_code' => $householdCode]);
    return $storageKeys;
}

function reg_photo_cleanup_expired_staged(PDO $pdo): void
{
    $stmt = $pdo->query(
        'SELECT `photo_id`, `storage_key`
         FROM `registration_photos`
         WHERE `state` = "staged" AND `created_at` < (CURRENT_TIMESTAMP - INTERVAL 48 HOUR)
         LIMIT 100'
    );
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    if ($rows === []) return;

    $deleteStmt = $pdo->prepare('DELETE FROM `registration_photos` WHERE `photo_id` = :photo_id AND `state` = "staged"');
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $deleteStmt->execute(['photo_id' => (string) ($row['photo_id'] ?? '')]);
        if ($deleteStmt->rowCount() > 0) {
            reg_photo_delete_storage_key((string) ($row['storage_key'] ?? ''));
        }
    }
}

function reg_photo_cleanup_deleted_files(PDO $pdo): void
{
    $stmt = $pdo->query(
        'SELECT `photo_id`, `storage_key`
         FROM `registration_photos`
         WHERE (`state` = "deleted" OR `deleted_at` IS NOT NULL)
           AND `storage_key` <> ""
         ORDER BY `deleted_at` ASC, `photo_id` ASC
         LIMIT 100'
    );
    $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    if ($rows === []) return;

    $markPurged = $pdo->prepare(
        'UPDATE `registration_photos`
         SET `storage_key` = "", `updated_at` = CURRENT_TIMESTAMP
         WHERE `photo_id` = :photo_id
           AND `storage_key` = :storage_key
           AND (`state` = "deleted" OR `deleted_at` IS NOT NULL)
         LIMIT 1'
    );
    foreach ($rows as $row) {
        if (!is_array($row)) continue;
        $photoId = trim((string) ($row['photo_id'] ?? ''));
        $storageKey = trim((string) ($row['storage_key'] ?? ''));
        if ($photoId === '' || $storageKey === '') continue;
        if (!reg_photo_delete_storage_key($storageKey)) continue;

        // Keep the tombstone/UUID for replay protection and audit history, but
        // clear the key as a durable marker that the private file is gone.
        $markPurged->execute([
            'photo_id' => $photoId,
            'storage_key' => $storageKey,
        ]);
    }
}
