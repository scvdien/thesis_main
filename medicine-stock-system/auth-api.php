<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$method = mss_api_request_method();

if ($method === 'GET') {
    $pdo = mss_api_bootstrap(false);
    $user = mss_auth_current_user($pdo);
    $setupRequired = mss_auth_setup_required($pdo);
    $locationLabel = trim((string) ($_GET['location'] ?? ''));

    if (!is_array($user)) {
        mss_api_respond([
            'success' => true,
            'authenticated' => false,
            'setupRequired' => $setupRequired,
            'user' => null,
            'redirect' => 'login.php',
        ]);
    }

    mss_auth_touch_session($pdo, $user, mss_api_client_ip(), $locationLabel);

    mss_api_respond([
        'success' => true,
        'authenticated' => true,
        'setupRequired' => false,
        'user' => mss_auth_user_payload($user),
        'redirect' => mss_auth_user_home($user),
    ]);
}

if ($method !== 'POST') {
    mss_api_error('Method not allowed.', 405);
}

$pdo = mss_api_bootstrap(false);
$input = mss_api_json_input();
$action = trim((string) ($input['action'] ?? $_POST['action'] ?? 'login'));

try {
    if ($action === 'logout') {
        mss_auth_logout($pdo);
        mss_api_respond([
            'success' => true,
            'message' => 'Signed out successfully.',
            'redirect' => 'login.php',
        ]);
    }

    if ($action === 'verify_current_password') {
        $user = mss_auth_require_user($pdo);
        $currentPassword = (string) ($input['currentPassword'] ?? $_POST['current_password'] ?? '');

        if ($currentPassword === '') {
            mss_api_error('Enter your current password first.', 422);
        }

        if (!password_verify($currentPassword, (string) ($user['password_hash'] ?? ''))) {
            mss_api_error('Current password is incorrect.', 401);
        }

        mss_auth_mark_recent_password_verification($pdo, $user);

        mss_api_respond([
            'success' => true,
            'message' => 'Current password verified.',
            'user' => mss_auth_user_payload($user),
        ]);
    }

    if ($action === 'refresh_current_session') {
        $rotate = filter_var($input['rotate'] ?? $_POST['rotate'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $locationLabel = trim((string) ($input['locationLabel'] ?? $_POST['location_label'] ?? ''));
        $sessionToken = mss_auth_read_session_token();
        $session = $sessionToken !== '' ? mss_auth_find_session_by_token($pdo, $sessionToken) : null;
        $sessionUserId = trim((string) ($_SESSION['mss_user_id'] ?? ($session['user_id'] ?? '')));
        if ($sessionUserId === '') {
            mss_api_error('Authentication required.', 401);
        }

        $freshUser = mss_auth_find_user_by_id($pdo, $sessionUserId);
        if (!is_array($freshUser) || trim((string) ($freshUser['status'] ?? '')) !== 'Active') {
            mss_auth_clear_session_state();
            mss_api_error('Authentication required.', 401);
        }

        if (is_array($session)
            && mss_auth_credentials_changed_after_session($freshUser, $session)
            && !mss_auth_has_recent_password_verification($pdo, $freshUser)
        ) {
            mss_auth_clear_session_state();
            mss_api_error('Authentication required.', 401);
        }

        mss_auth_refresh_current_session($pdo, $freshUser, mss_api_client_ip(), $locationLabel, '', $rotate);

        mss_api_respond([
            'success' => true,
            'message' => 'Session refreshed successfully.',
            'user' => mss_auth_user_payload($freshUser),
        ]);
    }

    if ($action === 'setup_admin') {
        $username = trim((string) ($input['username'] ?? $_POST['username'] ?? ''));
        $password = (string) ($input['password'] ?? $_POST['password'] ?? '');
        $confirmPassword = (string) ($input['confirmPassword'] ?? $input['passwordConfirm'] ?? $_POST['confirm_password'] ?? '');

        if (!mss_auth_setup_required($pdo)) {
            mss_api_error('The admin account is already configured. Please sign in instead.', 409, [
                'setupRequired' => false,
            ]);
        }
        if ($password !== $confirmPassword) {
            mss_api_error('Passwords do not match.', 422, [
                'setupRequired' => true,
            ]);
        }

        mss_auth_create_initial_admin($pdo, $username, $password);
        $user = mss_auth_attempt_login($pdo, $username, $password, mss_api_client_ip());

        mss_api_respond([
            'success' => true,
            'message' => 'Admin account created successfully.',
            'authenticated' => true,
            'setupRequired' => false,
            'user' => $user,
            'redirect' => (string) ($user['homePath'] ?? 'index.php'),
        ]);
    }

    if ($action !== 'login') {
        mss_api_error('Unsupported auth action.', 400);
    }

    if (mss_auth_setup_required($pdo)) {
        mss_api_error('Create the admin username and password first.', 409, [
            'setupRequired' => true,
        ]);
    }

    $username = trim((string) ($input['username'] ?? $_POST['username'] ?? ''));
    $password = (string) ($input['password'] ?? $_POST['password'] ?? '');
    $user = mss_auth_attempt_login($pdo, $username, $password, mss_api_client_ip());

    mss_api_respond([
        'success' => true,
        'message' => 'Signed in successfully.',
        'authenticated' => true,
        'setupRequired' => false,
        'user' => $user,
        'redirect' => (string) ($user['homePath'] ?? 'index.php'),
    ]);
} catch (InvalidArgumentException $exception) {
    mss_api_error($exception->getMessage(), 422);
} catch (RuntimeException $exception) {
    mss_api_error($exception->getMessage(), 401);
} catch (Throwable $exception) {
    mss_api_error('Unable to complete authentication right now.', 500);
}
