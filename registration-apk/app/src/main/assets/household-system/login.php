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

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode((string) $rawInput, true);
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

    if ($setupRequired) {
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
                auth_create_initial_captain($fullNameInput, $usernameInput, $passwordInput);
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
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> - Login</title>
  <link rel="icon" type="image/png" href="assets/img/barangay-cabarian-logo.png">

  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="<?= htmlspecialchars($loginStyleHref, ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="assets/css/password-toggle.css?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>">
</head>
<body>
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

            <button id="loginBtn" class="btn btn-primary w-100" type="submit"><?= $setupRequired ? 'Create Secure Account' : 'Sign In' ?></button>
            <div class="mobile-auth-note">
              <i class="bi bi-shield-check"></i>
              <span>Authorized Personnel Only</span>
            </div>
          </form>
        <?php endif; ?>
      </section>
    </div>
  </div>

  <footer>
    <div class="footer-copy">&copy; <?php echo date('Y'); ?> <?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?> | All Rights Reserved</div>
    <div class="app-version-badge text-center mt-2">
      Household Registration App <span class="badge bg-secondary text-white ms-1">v<?= htmlspecialchars(CABARIAN_APP_VERSION, ENT_QUOTES, 'UTF-8') ?></span>
    </div>
  </footer>

  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/password-toggle.js?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="assets/js/login-scripts.js?v=<?= htmlspecialchars($loginScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
  <script>
  (function() {
    var isApp = /CabarianRegistrationApp/i.test(navigator.userAgent)
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (isApp) {
      var badge = document.querySelector('.app-only-badge');
      if (badge) badge.style.display = 'block';
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



