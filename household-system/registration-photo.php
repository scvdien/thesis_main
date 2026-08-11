<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/registration-photo-storage.php';

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $authUser = auth_require_page([AUTH_ROLE_ADMIN, AUTH_ROLE_CAPTAIN, AUTH_ROLE_STAFF], true);
    try {
        $photoId = reg_photo_normalize_id($_GET['id'] ?? '', false);
    } catch (InvalidArgumentException $exception) {
        http_response_code(404);
        header('Cache-Control: private, no-store, max-age=0');
        exit;
    }

    try {
        $pdo = auth_db();
        // The schema is installed by the migration and the registration sync
        // bootstrap. Avoid issuing CREATE TABLE for every image request.
        $stmt = $pdo->prepare(
            'SELECT `storage_key`, `mime_type`, `size_bytes`, `state`, `created_by_user_id`, `deleted_at`
             FROM `registration_photos`
             WHERE `photo_id` = :photo_id
             LIMIT 1'
        );
        $stmt->execute(['photo_id' => $photoId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $viewerUserId = (int) ($authUser['id'] ?? 0);
        $canViewStaged = is_array($row)
            && (string) ($row['state'] ?? '') === 'staged'
            && (int) ($row['created_by_user_id'] ?? 0) === $viewerUserId;
        if (
            !is_array($row)
            || !empty($row['deleted_at'])
            || ((string) ($row['state'] ?? '') !== 'attached' && !$canViewStaged)
        ) {
            http_response_code(404);
            header('Cache-Control: private, no-store, max-age=0');
            exit;
        }

        $path = reg_photo_storage_path((string) ($row['storage_key'] ?? ''));
        if (!is_file($path) || !is_readable($path)) {
            http_response_code(404);
            header('Cache-Control: private, no-store, max-age=0');
            exit;
        }

        $photoBytes = @file_get_contents($path);
        if ($photoBytes === false || $photoBytes === '' || strlen($photoBytes) > REG_PHOTO_MAX_STORED_BYTES) {
            throw new RuntimeException('Private photo file could not be read.');
        }
        $size = strlen($photoBytes);
        header('Content-Type: image/jpeg');
        header('Content-Disposition: inline; filename="profile-photo.jpg"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store, max-age=0');
        header('Pragma: no-cache');
        if ($size > 0) header('Content-Length: ' . $size);
        echo $photoBytes;
        exit;
    } catch (Throwable $exception) {
        error_log('Registration photo read error: ' . $exception->getMessage());
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store, max-age=0');
        echo 'Photo is temporarily unavailable.';
        exit;
    }
}

if ($method !== 'POST') {
    auth_json_error(405, 'Method not allowed.');
}

$declaredLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($declaredLength > (REG_PHOTO_MAX_UPLOAD_BYTES + (512 * 1024))) {
    auth_json_error(413, 'Photo upload is too large.');
}

$authUser = auth_require_api([AUTH_ROLE_ADMIN, AUTH_ROLE_STAFF]);
$csrfToken = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
if (!auth_csrf_valid($csrfToken)) {
    auth_json_error(419, 'Invalid CSRF token.');
}

try {
    $photoId = reg_photo_normalize_id($_POST['photo_id'] ?? '', false);
    $subjectType = reg_photo_normalize_subject_type($_POST['subject_type'] ?? '');
    $upload = $_FILES['photo'] ?? null;
    if (!is_array($upload)) {
        throw new InvalidArgumentException('A photo file is required.');
    }

    $pdo = auth_db();
    reg_photo_bootstrap_table($pdo);
    reg_photo_cleanup_expired_staged($pdo);
    reg_photo_cleanup_deleted_files($pdo);
    $stored = reg_photo_store_upload($upload);
    $actorUserId = (int) ($authUser['id'] ?? 0);
    $createdNewPhoto = false;

    $pdo->beginTransaction();
    try {
        $existingStmt = $pdo->prepare(
            'SELECT `photo_id`, `subject_type`, `sha256`, `storage_key`, `created_by_user_id`, `deleted_at`
             FROM `registration_photos`
             WHERE `photo_id` = :photo_id
             LIMIT 1 FOR UPDATE'
        );
        $existingStmt->execute(['photo_id' => $photoId]);
        $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

        if (is_array($existing)) {
            if (!empty($existing['deleted_at'])) {
                throw new RuntimeException('This photo reference is no longer available.');
            }
            if ((int) ($existing['created_by_user_id'] ?? 0) !== $actorUserId) {
                throw new RuntimeException('This photo reference belongs to another user.');
            }
            if ((string) ($existing['subject_type'] ?? '') !== $subjectType) {
                throw new RuntimeException('This photo reference uses another profile type.');
            }
            if (!hash_equals((string) ($existing['sha256'] ?? ''), (string) ($stored['sha256'] ?? ''))) {
                throw new RuntimeException('This photo reference already contains another image.');
            }
            $pdo->commit();
            reg_photo_delete_storage_key((string) ($stored['storage_key'] ?? ''));
        } else {
            $insert = $pdo->prepare(
                'INSERT INTO `registration_photos`
                 (`photo_id`, `subject_type`, `storage_key`, `mime_type`, `size_bytes`, `width`, `height`, `sha256`, `state`, `created_by_user_id`)
                 VALUES
                 (:photo_id, :subject_type, :storage_key, :mime_type, :size_bytes, :width, :height, :sha256, "staged", :created_by_user_id)'
            );
            $insert->execute([
                'photo_id' => $photoId,
                'subject_type' => $subjectType,
                'storage_key' => (string) $stored['storage_key'],
                'mime_type' => (string) $stored['mime_type'],
                'size_bytes' => (int) $stored['size_bytes'],
                'width' => (int) $stored['width'],
                'height' => (int) $stored['height'],
                'sha256' => (string) $stored['sha256'],
                'created_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
            ]);
            $pdo->commit();
            $createdNewPhoto = true;
        }
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        reg_photo_delete_storage_key((string) ($stored['storage_key'] ?? ''));
        throw $exception;
    }

    if ($createdNewPhoto) {
        auth_audit_log([
            'user' => $authUser,
            'action_key' => 'registration_photo_uploaded',
            'action_type' => 'created',
            'module_name' => 'Registration',
            'record_type' => 'registration_photo',
            'record_id' => $photoId,
            'details' => 'Uploaded an optional registration photo.',
            'metadata' => [
                'subject_type' => $subjectType,
                'size_bytes' => (int) ($stored['size_bytes'] ?? 0),
                'width' => (int) ($stored['width'] ?? 0),
                'height' => (int) ($stored['height'] ?? 0),
            ],
        ]);
    }

    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'photo_id' => $photoId,
        'subject_type' => $subjectType,
        'photo_url' => reg_photo_public_url($photoId),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (InvalidArgumentException $exception) {
    auth_json_error(422, trim($exception->getMessage()));
} catch (PDOException $exception) {
    error_log('Registration photo database error: ' . $exception->getMessage());
    auth_json_error(500, 'Photo storage is temporarily unavailable. Please try again.');
} catch (Throwable $exception) {
    error_log('Registration photo error: ' . $exception->getMessage());
    auth_json_error(409, 'Unable to save photo. Please try again.');
}
