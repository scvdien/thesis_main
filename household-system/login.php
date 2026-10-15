<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (isset($_GET['csrf_token_refresh'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['csrf_token' => auth_csrf_token()]);
    exit;
}

$explicitLogoutRequested = (string) ($_GET['logged_out'] ?? '') === '1';
$existingUser = auth_current_user();
if ($explicitLogoutRequested && is_array($existingUser)) {
    auth_logout();
    $existingUser = null;
}
if (is_array($existingUser) && !isset($_GET['sw_cache']) && !isset($_GET['offline_cache'])) {
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
        auth_redirect(auth_user_home($existingUser));
    }
}

$fullNameInput = '';
$usernameInput = '';
$errorMessage = '';

try {
    auth_bootstrap_store();
    $setupRequired = auth_setup_required(auth_db());
    $setupAllowed = $setupRequired && auth_initial_setup_allowed();
    $setupLocked = $setupRequired && !$setupAllowed;
} catch (Throwable $dbEx) {
    $setupRequired = false;
    $setupAllowed = false;
    $setupLocked = false;
    $errorMessage = 'Unable to connect to database service. Please ensure database is available.';
}

if ($setupLocked) {
    $errorMessage = auth_initial_setup_lock_message();
}

$isJsonRequest = (
    (isset($_SERVER['HTTP_ACCEPT']) && stripos((string) $_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
    || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower((string) $_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
);

$recoverySuccessMessage = '';
$sessionRecoveryKey = (string) ($_SESSION['cabarian_setup_recovery_key'] ?? '');
$sessionRedirectUrl = (string) ($_SESSION['cabarian_setup_redirect_url'] ?? '');
if ($sessionRecoveryKey !== '') {
    unset($_SESSION['cabarian_setup_recovery_key'], $_SESSION['cabarian_setup_redirect_url']);
}

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode((string) $rawInput, true);
    $action = is_array($jsonData) ? (string) ($jsonData['action'] ?? '') : (string) ($_POST['action'] ?? '');

    if (is_array($jsonData)) {
        $fullNameInput = trim((string) ($jsonData['full_name'] ?? ''));
        $usernameInput = trim((string) ($jsonData['username'] ?? ''));
        $passwordInput = (string) ($jsonData['password'] ?? '');
        $passwordConfirmInput = (string) ($jsonData['password_confirm'] ?? '');
        $csrfToken = (string) ($jsonData['csrf_token'] ?? '');
    } else {
        $fullNameInput = trim((string) ($_POST['full_name'] ?? ''));
        $usernameInput = trim((string) ($_POST['username'] ?? ''));
        $passwordInput = (string) ($_POST['password'] ?? '');
        $passwordConfirmInput = (string) ($_POST['password_confirm'] ?? '');
        $csrfToken = (string) ($_POST['csrf_token'] ?? '');
    }

    $isAppClient = (isset($_SERVER['HTTP_USER_AGENT']) && stripos((string) $_SERVER['HTTP_USER_AGENT'], 'CabarianRegistrationApp') !== false)
        || ($csrfToken === 'offline-token');
    $isCsrfValid = auth_csrf_valid($csrfToken) || $isAppClient;

    if ($action === 'verify_recovery_key') {
        $recKey = trim(is_array($jsonData) ? (string) ($jsonData['recovery_key'] ?? '') : (string) ($_POST['recovery_key'] ?? ''));

        if (!$isCsrfValid) {
            $errorMessage = 'Your session expired. Please refresh the page.';
        } elseif ($recKey === '') {
            $errorMessage = 'Please enter your master recovery key.';
        } else {
            $captain = auth_find_captain_by_recovery_key($recKey);
            if (is_array($captain)) {
                $recoveryToken = bin2hex(random_bytes(32));
                $_SESSION['recovery_verified_captain_id'] = (int) $captain['id'];
                $_SESSION['recovery_verified_token'] = $recoveryToken;

                if ($isJsonRequest) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'success' => true,
                        'captain_name' => (string) ($captain['full_name'] ?? 'Barangay Captain'),
                        'captain_username' => (string) ($captain['username'] ?? ''),
                        'recovery_token' => $recoveryToken,
                        'csrf_token' => auth_csrf_token(),
                    ]);
                    exit;
                }
            } else {
                $errorMessage = 'Invalid master recovery key. Please check your backup code and try again.';
            }
        }

        if ($isJsonRequest) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => $errorMessage,
                'csrf_token' => auth_csrf_token(),
            ]);
            exit;
        }
    } elseif ($action === 'complete_recovery') {
        $recToken = trim(is_array($jsonData) ? (string) ($jsonData['recovery_token'] ?? '') : (string) ($_POST['recovery_token'] ?? ''));
        $newUsername = trim(is_array($jsonData) ? (string) ($jsonData['new_username'] ?? '') : (string) ($_POST['new_username'] ?? ''));
        $newPassword = (string) (is_array($jsonData) ? ($jsonData['new_password'] ?? '') : ($_POST['new_password'] ?? ''));
        $newPasswordConfirm = (string) (is_array($jsonData) ? ($jsonData['new_password_confirm'] ?? '') : ($_POST['new_password_confirm'] ?? ''));

        $verifiedId = (int) ($_SESSION['recovery_verified_captain_id'] ?? 0);
        $sessionToken = (string) ($_SESSION['recovery_verified_token'] ?? '');

        if (!$isCsrfValid) {
            $errorMessage = 'Your session expired. Please refresh the page.';
        } elseif ($verifiedId <= 0 || $sessionToken === '' || !hash_equals($sessionToken, $recToken)) {
            $errorMessage = 'Recovery session expired. Please verify your recovery key again.';
        } elseif ($newUsername === '' || $newPassword === '' || $newPasswordConfirm === '') {
            $errorMessage = 'Please complete all fields.';
        } elseif ($newPassword !== $newPasswordConfirm) {
            $errorMessage = 'Passwords do not match.';
        } elseif (strlen($newPassword) < 8 || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
            $errorMessage = 'Password must be at least 8 characters and include at least 1 special character.';
        } else {
            $updateResult = auth_complete_captain_recovery($verifiedId, $newUsername, $newPassword);
            if ($updateResult['success']) {
                unset($_SESSION['recovery_verified_captain_id'], $_SESSION['recovery_verified_token']);
                
                // Attempt automatic login
                $loginResult = auth_attempt_login($newUsername, $newPassword);
                $redirectUrl = 'index.php';
                if (($loginResult['success'] ?? false) === true && is_array($loginResult['user'] ?? null)) {
                    $redirectUrl = auth_user_home($loginResult['user']);
                }

                if ($isJsonRequest) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'success' => true,
                        'message' => 'Credentials updated successfully! Logging you into the dashboard...',
                        'redirect' => $redirectUrl,
                        'csrf_token' => auth_csrf_token(),
                    ]);
                    exit;
                }
                auth_redirect($redirectUrl);
            } else {
                $errorMessage = (string) ($updateResult['error'] ?? 'Unable to update credentials.');
            }
        }

        if ($isJsonRequest) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => $errorMessage,
                'csrf_token' => auth_csrf_token(),
            ]);
            exit;
        }
    } elseif ($action === 'recover_captain') {
        $recUsername = trim(is_array($jsonData) ? (string) ($jsonData['recovery_username'] ?? '') : (string) ($_POST['recovery_username'] ?? ''));
        $recKey = trim(is_array($jsonData) ? (string) ($jsonData['recovery_key'] ?? '') : (string) ($_POST['recovery_key'] ?? ''));
        $recPassword = (string) (is_array($jsonData) ? ($jsonData['recovery_password'] ?? '') : ($_POST['recovery_password'] ?? ''));
        $recPasswordConfirm = (string) (is_array($jsonData) ? ($jsonData['recovery_password_confirm'] ?? '') : ($_POST['recovery_password_confirm'] ?? ''));

        if (!$isCsrfValid) {
            $errorMessage = 'Your session expired. Please try again.';
        } elseif ($recUsername === '' || $recKey === '' || $recPassword === '' || $recPasswordConfirm === '') {
            $errorMessage = 'Complete all recovery fields.';
        } elseif ($recPassword !== $recPasswordConfirm) {
            $errorMessage = 'Passwords do not match.';
        } elseif (strlen($recPassword) < 8 || !preg_match('/[^A-Za-z0-9]/', $recPassword)) {
            $errorMessage = 'Password must be at least 8 characters and include at least 1 special character.';
        } else {
            $recoveryResult = auth_reset_captain_with_recovery_key($recUsername, $recKey, $recPassword);
            if ($recoveryResult['success']) {
                if ($isJsonRequest) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'success' => true,
                        'message' => 'Captain password reset successfully! You can now sign in with your new password.',
                        'csrf_token' => auth_csrf_token(),
                    ]);
                    exit;
                }
                $recoverySuccessMessage = 'Captain password reset successfully! You can now sign in with your new password.';
            } else {
                $errorMessage = (string) ($recoveryResult['error'] ?? 'Unable to reset password.');
            }
        }

        if ($isJsonRequest) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => $errorMessage,
                'csrf_token' => auth_csrf_token(),
            ]);
            exit;
        }
    } elseif ($setupRequired) {
        if (!$isCsrfValid) {
            $errorMessage = 'Your session expired. Please try signing in again.';
        } elseif (!$setupAllowed) {
            $errorMessage = auth_initial_setup_lock_message();
        } elseif ($fullNameInput === '' || $usernameInput === '' || $passwordInput === '' || $passwordConfirmInput === '') {
            $errorMessage = 'Complete all fields to create the first captain account.';
        } elseif ($passwordInput !== $passwordConfirmInput) {
            $errorMessage = 'Passwords do not match.';
        } else {
            try {
                $captainAccount = auth_create_initial_captain($fullNameInput, $usernameInput, $passwordInput);
                $recoveryKey = (string) ($captainAccount['recovery_key'] ?? '');
                $result = auth_attempt_login($usernameInput, $passwordInput);
                if (($result['success'] ?? false) === true && is_array($result['user'] ?? null)) {
                    $loggedInUser = $result['user'];
                    $redirectUrl = auth_user_home($loggedInUser);
                    if ($isJsonRequest) {
                        header('Content-Type: application/json; charset=utf-8');
                        echo json_encode([
                            'success' => true,
                            'redirect' => $redirectUrl,
                            'user' => $loggedInUser,
                            'recovery_key' => $recoveryKey,
                            'csrf_token' => auth_csrf_token(),
                        ]);
                        exit;
                    }
                    $_SESSION['cabarian_setup_recovery_key'] = $recoveryKey;
                    $_SESSION['cabarian_setup_redirect_url'] = $redirectUrl;
                    auth_redirect('login.php?setup_done=1');
                }
                $errorMessage = (string) ($result['error'] ?? 'Initial setup completed. Please sign in.');
            } catch (Throwable $exception) {
                if ($exception instanceof InvalidArgumentException || $exception instanceof RuntimeException) {
                    $errorMessage = $exception->getMessage();
                } else {
                    $errorMessage = 'Unable to complete initial setup right now. Please try again.';
                }
            }
        }
    } else {
        if ($usernameInput === '' || $passwordInput === '') {
            $errorMessage = 'Please enter username and password.';
        } else {
            try {
                $result = auth_attempt_login($usernameInput, $passwordInput);
                if (($result['success'] ?? false) === true && is_array($result['user'] ?? null)) {
                    $loggedInUser = $result['user'];
                    $redirectUrl = auth_user_home($loggedInUser);
                    if ($isJsonRequest) {
                        header('Content-Type: application/json; charset=utf-8');
                        echo json_encode([
                            'success' => true,
                            'redirect' => $redirectUrl,
                            'user' => $loggedInUser,
                            'csrf_token' => auth_csrf_token(),
                        ]);
                        exit;
                    }
                    auth_redirect($redirectUrl);
                }
                $errorMessage = (string) ($result['error'] ?? 'Invalid username or password.');
            } catch (Throwable $exception) {
                $errorMessage = 'Unable to connect to authentication service. Please try again.';
            }
        }
    }

    if ($isJsonRequest) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error' => $errorMessage,
            'csrf_token' => auth_csrf_token(),
        ]);
        exit;
    }

    try {
        $setupRequired = auth_setup_required(auth_db());
        $setupAllowed = $setupRequired && auth_initial_setup_allowed();
        $setupLocked = $setupRequired && !$setupAllowed;
        if ($setupLocked && $errorMessage === '') {
            $errorMessage = auth_initial_setup_lock_message();
        }
    } catch (Throwable $dbEx) {
        $setupRequired = false;
        $setupAllowed = false;
        $setupLocked = false;
    }
}

$csrfToken = auth_csrf_token();
$brandBarangay = trim(auth_env(['BARANGAY_NAME'], 'Barangay'));
$brandCity = trim(auth_env(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], ''));
try {
    $profilePdo = auth_db();
    $profileStmt = $profilePdo->query('SELECT `barangay_name`, `city_name` FROM `barangay_profile` WHERE `id` = 1 LIMIT 1');
    $profileRow = $profileStmt instanceof PDOStatement ? $profileStmt->fetch(PDO::FETCH_ASSOC) : null;
    if (is_array($profileRow)) {
        $profileBarangay = trim((string) ($profileRow['barangay_name'] ?? ''));
        $profileCity = trim((string) ($profileRow['city_name'] ?? ''));
        if ($profileBarangay !== '') {
            $brandBarangay = $profileBarangay;
        }
        if ($profileCity !== '') {
            $brandCity = $profileCity;
        }
    }
} catch (Throwable $exception) {
    // Fall back to environment defaults when profile data is unavailable.
}
$brandLabel = $brandBarangay !== '' ? $brandBarangay : 'Barangay';
if (stripos($brandLabel, 'barangay') !== 0) {
    $brandLabel = trim('Barangay ' . $brandLabel);
}
$accessAreaLabel = $brandCity !== '' ? $brandCity : $brandLabel;
$brandLabel = 'Cabarian Ligao City';
$accessAreaLabel = $brandLabel;
$loginStyleVersion = @filemtime(__DIR__ . '/assets/css/login-style.css');
$loginStyleHref = 'assets/css/login-style.css' . ($loginStyleVersion ? '?v=' . rawurlencode((string) $loginStyleVersion) : '');
$passwordToggleVersion = (string) (@filemtime(__DIR__ . '/assets/js/password-toggle.js') ?: time());
$loginScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/login-scripts.js') ?: time());
$panelEyebrow = $setupLocked ? 'Setup Locked' : ($setupRequired ? 'System Setup' : 'Welcome back');
$panelHeading = $setupLocked
    ? 'Initial setup is disabled on this server'
    : ($setupRequired ? 'Create the first captain account' : 'Sign in to your account');
$panelDescription = $setupLocked
    ? 'Initial account creation is currently disabled by server configuration.'
    : ($setupRequired
        ? 'No user accounts exist yet. Complete the secure first-time setup before going online.'
        : 'Use your assigned credentials to continue.');
$formMode = $setupRequired ? ($setupAllowed ? 'setup' : 'setup_locked') : 'login';
$isAndroidApp = (isset($_SERVER['HTTP_USER_AGENT']) && stripos((string) $_SERVER['HTTP_USER_AGENT'], 'CabarianRegistrationApp') !== false);
?>
<!doctype html>
<html lang="en" class="<?= $isAndroidApp ? 'is-cabarian-app' : '' ?>">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> - Login</title>
  <link rel="icon" type="image/png" href="assets/img/barangay-cabarian-logo.png">
  <script>
    if (/CabarianRegistrationApp/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('is-cabarian-app');
    }
  </script>

  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="<?= htmlspecialchars($loginStyleHref, ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="assets/css/password-toggle.css?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="<?= $isAndroidApp ? 'is-cabarian-app' : '' ?>">
  <div class="page">
    <div class="login-shell">
      <section class="brand-panel reveal delay-1">
        <div class="brand-badge">
          <i class="bi bi-shield-lock-fill"></i>
          Authorized Access
        </div>
        <div class="brand-mark">
          <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
          <div class="brand-copy">
            <div class="brand-title"><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?></div>
            <div class="brand-sub">Online Household Information Management System</div>
          </div>
          <img class="brand-mark-secondary" src="assets/img/ligao-city-logo.png" alt="<?= htmlspecialchars($accessAreaLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
        </div>
        <p class="brand-desc">
          Secure access for authorized personnel of <?= htmlspecialchars($accessAreaLabel, ENT_QUOTES, 'UTF-8') ?>. Manage resident
          records, reports, and community services in one place.
        </p>
        <div class="brand-logos">
          <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
          <img src="assets/img/ligao-city-logo.png" alt="<?= htmlspecialchars($accessAreaLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
        </div>
        <div class="brand-note">
          <i class="bi bi-shield-check"></i>
          Authorized Personnel Only
        </div>
      </section>

      <section class="form-panel reveal delay-2">
        <div class="mobile-card-logos">
          <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
          <img src="assets/img/ligao-city-logo.png" alt="<?= htmlspecialchars($accessAreaLabel, ENT_QUOTES, 'UTF-8') ?> Logo">
        </div>
        <div class="form-head">
          <span class="eyebrow"><?= htmlspecialchars($panelEyebrow, ENT_QUOTES, 'UTF-8') ?></span>
          <h2><?= htmlspecialchars($panelHeading, ENT_QUOTES, 'UTF-8') ?></h2>
          <p><?= htmlspecialchars($panelDescription, ENT_QUOTES, 'UTF-8') ?></p>
        </div>

        <?php if ($setupLocked): ?>
          <div id="error" class="form-error is-visible" role="alert" aria-live="polite">
            <?php echo htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'); ?>
          </div>
          <p class="small text-muted mb-0">
            Remove <code>AUTH_DISABLE_INITIAL_SETUP=1</code> or <code>HIMS_DISABLE_INITIAL_SETUP=1</code> from your server config to continue.
          </p>
        <?php else: ?>
          <form id="loginForm" class="login-form" autocomplete="on" method="post" action="login.php" data-mode="<?= htmlspecialchars($formMode, ENT_QUOTES, 'UTF-8') ?>" novalidate>
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">

            <?php if ($setupRequired): ?>
              <div class="field">
                <label for="full_name">Captain Full Name</label>
                <div class="input-wrap">
                  <i class="bi bi-person-badge"></i>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    class="form-control"
                    placeholder="Enter full name"
                    autocomplete="name"
                    value="<?php echo htmlspecialchars($fullNameInput, ENT_QUOTES, 'UTF-8'); ?>"
                    required
                  >
                </div>
              </div>
            <?php endif; ?>

            <div class="field">
              <label for="username">Username</label>
              <div class="input-wrap">
                <i class="bi bi-person"></i>
                <input
                  type="text"
                  id="username"
                  name="username"
                  class="form-control"
                  placeholder="Enter your username"
                  autocomplete="username"
                  value="<?php echo htmlspecialchars($usernameInput, ENT_QUOTES, 'UTF-8'); ?>"
                  required
                >
              </div>
            </div>

            <div class="field">
              <label for="password">Password</label>
              <div class="input-wrap">
                <i class="bi bi-lock"></i>
                <input type="password" id="password" name="password" class="form-control" placeholder="<?= $setupRequired ? '8+ chars, include 1 special character' : 'Enter your password' ?>" autocomplete="<?= $setupRequired ? 'new-password' : 'current-password' ?>" required>
              </div>
            </div>

            <?php if (!$setupRequired && !$isAndroidApp): ?>
              <div class="d-flex justify-content-end mt-1 mb-2 captain-recovery-wrap">
                <button type="button" class="btn btn-link p-0 text-decoration-none" id="toggleRecoveryLink" style="font-size: 13px; color: #0a66d3; font-weight: 500;">
                  <i class="bi bi-key"></i> Forgot Captain Password?
                </button>
              </div>
            <?php endif; ?>

            <?php if ($setupRequired): ?>
              <div class="field">
                <label for="password_confirm">Confirm Password</label>
                <div class="input-wrap">
                  <i class="bi bi-shield-lock"></i>
                  <input type="password" id="password_confirm" name="password_confirm" class="form-control" placeholder="Re-enter password" autocomplete="new-password" required>
                </div>
              </div>
            <?php endif; ?>

            <div id="error" class="form-error<?php echo $errorMessage !== '' ? ' is-visible' : ''; ?>" role="alert" aria-live="polite">
              <?php echo htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'); ?>
            </div>
            <?php if ($recoverySuccessMessage !== ''): ?>
              <div id="recoverySuccessAlert" class="alert alert-success fade show small py-2 text-center" role="alert" style="transition: opacity 0.5s ease, transform 0.5s ease;">
                <?php echo htmlspecialchars($recoverySuccessMessage, ENT_QUOTES, 'UTF-8'); ?>
              </div>
            <?php endif; ?>
            <?php if (isset($_GET['turnover_done'])): ?>
              <div id="turnoverSuccessAlert" class="alert alert-success fade show small py-2 text-center" role="alert" style="transition: opacity 0.5s ease, transform 0.5s ease;">
                <i class="bi bi-check-circle-fill me-1"></i> Leadership turnover completed successfully! Incoming Barangay Captain may now sign in.
              </div>
            <?php endif; ?>

            <button id="loginBtn" class="btn btn-primary w-100" type="submit"><?= $setupRequired ? 'Create Secure Account' : 'Sign In' ?></button>
            <div class="mobile-auth-note">
              <i class="bi bi-shield-check"></i>
              <span>Authorized Personnel Only</span>
            </div>
          </form>

          <?php if (!$setupRequired && !$isAndroidApp): ?>
          <form id="recoveryForm" class="login-form d-none" method="post" action="login.php" autocomplete="off" novalidate>
            <input type="hidden" id="recoveryCsrfToken" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
            <input type="hidden" id="recoveryToken" name="recovery_token" value="">
            
            <div class="mb-3 text-start">
              <button type="button" class="btn btn-link text-decoration-none p-0" id="backToLoginBtn" style="color: var(--muted); font-size: 13px;">
                <i class="bi bi-arrow-left"></i> Back to Sign In
              </button>
            </div>
            
            <!-- STEP 1: VERIFY RECOVERY KEY -->
            <div id="recoveryStep1" class="d-flex flex-column gap-3">
              <div class="form-head mb-1">
                <div class="form-kicker" style="color: var(--accent); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">Account Recovery</div>
                <h3 class="form-title" style="font-size: 22px; font-weight: 700; margin: 4px 0 6px;">Enter Master Recovery Key</h3>
                <p class="form-subtitle" style="font-size: 13px; color: var(--muted); margin: 0;">Enter your 16-character backup key to verify your identity as Barangay Captain.</p>
              </div>

              <div class="field">
                <label for="recovery_key">Master Recovery Key</label>
                <div class="input-wrap">
                  <i class="bi bi-key"></i>
                  <input type="text" id="recovery_key" name="recovery_key" class="form-control text-uppercase font-monospace" placeholder="CAB-XXXX-XXXX-XXXX" maxlength="25" autocomplete="off" spellcheck="false" required style="letter-spacing: 1px;">
                </div>
              </div>

              <div id="recoveryStep1Error" class="form-error" role="alert" aria-live="polite"></div>

              <button id="verifyRecoveryKeyBtn" class="btn btn-primary w-100" type="button">
                Verify Recovery Key <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>

            <!-- STEP 2: SET NEW USERNAME & PASSWORD -->
            <div id="recoveryStep2" class="d-none flex-column gap-3">
              <div class="p-3 mb-3 rounded-3 border d-flex align-items-center gap-3" style="background: #f0fdf4; border-color: #bbf7d0 !important;">
                <div class="rounded-circle bg-success text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                  <i class="bi bi-shield-check" style="font-size: 1.3rem;"></i>
                </div>
                <div class="text-start">
                  <div class="text-uppercase text-muted fw-bold" style="font-size: 0.68rem; letter-spacing: 0.06em;">Verified Barangay Captain</div>
                  <div class="fw-bold text-dark" id="verifiedCaptainName" style="font-size: 0.95rem;">Barangay Captain</div>
                </div>
              </div>

              <div class="form-head mb-3">
                <h3 class="form-title" style="font-size: 20px; font-weight: 700; margin: 0 0 4px;">Set New Credentials</h3>
                <p class="form-subtitle" style="font-size: 13px; color: var(--muted); margin: 0;">Update your username and create a new secure password.</p>
              </div>

              <div class="field">
                <label for="recovery_new_username">Captain Username</label>
                <div class="input-wrap">
                  <i class="bi bi-person"></i>
                  <input type="text" id="recovery_new_username" name="new_username" class="form-control" placeholder="Enter captain username" required autocomplete="username">
                </div>
              </div>

              <div class="field">
                <label for="recovery_new_password">New Password</label>
                <div class="input-wrap">
                  <i class="bi bi-lock"></i>
                  <input type="password" id="recovery_new_password" name="new_password" class="form-control" placeholder="8+ chars, 1 special character" minlength="8" required autocomplete="new-password">
                </div>
              </div>

              <div class="field">
                <label for="recovery_new_password_confirm">Confirm New Password</label>
                <div class="input-wrap">
                  <i class="bi bi-shield-lock"></i>
                  <input type="password" id="recovery_new_password_confirm" name="new_password_confirm" class="form-control" placeholder="Re-enter new password" minlength="8" required autocomplete="new-password">
                </div>
              </div>

              <div id="recoveryStep2Error" class="form-error" role="alert" aria-live="polite"></div>
              <div id="recoveryStep2Success" class="alert alert-success d-none small py-2 text-center" role="alert"></div>

              <button id="completeRecoveryBtn" class="btn btn-primary w-100" type="button">
                Save Credentials & Sign In <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>

            <div class="mobile-auth-note mt-3">
              <i class="bi bi-shield-check"></i>
              <span>Authorized Captain Recovery Only</span>
            </div>
          </form>
          <?php endif; ?>
        <?php endif; ?>
      </section>
    </div>
  </div>

  <footer>
    <div class="footer-copy">&copy; <?php echo date('Y'); ?> <?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?> | All Rights Reserved</div>
    <div class="app-version-badge text-center mt-2">
      Cabarian Registration <span class="badge bg-secondary text-white ms-1">v<?= htmlspecialchars(CABARIAN_APP_VERSION, ENT_QUOTES, 'UTF-8') ?></span>
    </div>
  </footer>

  <!-- MASTER RECOVERY KEY MODAL -->
  <div class="modal fade" id="recoveryKeyModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content text-center p-4" style="border-radius: 16px; border: none; box-shadow: 0 20px 45px rgba(0,0,0,0.18);">
        <div class="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary mx-auto" style="width: 60px; height: 60px;">
          <i class="bi bi-shield-lock-fill" style="font-size: 1.75rem;"></i>
        </div>
        <h4 class="fw-bold text-dark mb-2">Save Master Recovery Key</h4>
        <p class="text-secondary small mb-3" style="line-height: 1.55;">
          This is your emergency backup key. <strong>Store it in a safe and secure place.</strong> You will need this key to reset your password if you ever forget your credentials.
        </p>

        <div class="p-3 mb-3 rounded-3 border" style="background: #f8fafc;">
          <div class="text-uppercase text-muted fw-bold mb-2" style="font-size: 0.7rem; letter-spacing: 0.08em;">Barangay Captain Recovery Key</div>
          <div class="d-flex align-items-center justify-content-center mb-3">
            <code id="recoveryKeyDisplay" class="fs-4 fw-bold text-primary font-monospace" style="letter-spacing: 2px;">CAB-XXXX-XXXX-XXXX</code>
          </div>
          <div class="d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm px-3" id="copyRecoveryKeyBtn" title="Copy to clipboard">
              <i class="bi bi-clipboard me-1"></i> <span id="copyKeyText">Copy Key</span>
            </button>
            <button type="button" class="btn btn-outline-primary btn-sm px-3" id="downloadRecoveryKeyBtn" title="Download backup slip">
              <i class="bi bi-download me-1"></i> Download Key (.txt)
            </button>
          </div>
        </div>

        <div class="form-check text-start mb-4" style="max-width: 380px; margin: 0 auto;">
          <input class="form-check-input" type="checkbox" id="confirmSavedKey" style="cursor: pointer;">
          <label class="form-check-label small text-secondary" for="confirmSavedKey" style="cursor: pointer; user-select: none;">
            I have saved this recovery key in a safe and secure place.
          </label>
        </div>

        <button type="button" class="btn btn-primary w-100 py-2 fw-semibold" id="proceedDashboardBtn" disabled style="border-radius: 8px;">
          Proceed to Dashboard <i class="bi bi-arrow-right ms-1"></i>
        </button>
      </div>
    </div>
  </div>

  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/password-toggle.js?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="assets/js/login-scripts.js?v=<?= htmlspecialchars($loginScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
  <?php if ($sessionRecoveryKey !== ''): ?>
  <script>
    window.__INITIAL_RECOVERY_KEY = <?= json_encode($sessionRecoveryKey) ?>;
    window.__INITIAL_REDIRECT_URL = <?= json_encode($sessionRedirectUrl ?: 'index.php') ?>;
  </script>
  <?php endif; ?>
  <script>
  (function() {
    var isApp = /CabarianRegistrationApp/i.test(navigator.userAgent);
    if (isApp) {
      document.documentElement.classList.add('is-cabarian-app');
      if (document.body) {
        document.body.classList.add('is-cabarian-app');
      }
    }
  })();
  </script>
  <script>
  // Register service worker on login page so it gets cached for offline use
  if ('serviceWorker' in navigator) {
    const swUrl = new URL('service-worker.js', new URL('./', window.location.href)).toString();
    const swScope = new URL('./', window.location.href);
    const scopePath = swScope.pathname.endsWith('/') ? swScope.pathname : swScope.pathname + '/';
    navigator.serviceWorker.register(swUrl, { scope: scopePath, updateViaCache: 'none' })
      .then(function(reg) {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Cache this login page for offline use
        var worker = navigator.serviceWorker.controller || reg.active;
        if (worker) {
          worker.postMessage({ type: 'CACHE_CURRENT_ROUTE', url: window.location.href });
        }
      })
      .catch(function() { /* SW registration is best-effort on login page */ });
  }
  </script>
</body>
</html>



