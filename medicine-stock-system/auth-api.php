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
