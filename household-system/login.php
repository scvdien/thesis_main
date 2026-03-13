<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$existingUser = auth_current_user();
if (is_array($existingUser)) {
    auth_redirect(auth_user_home($existingUser));
}

$fullNameInput = '';
$usernameInput = '';
$errorMessage = '';

auth_bootstrap_store();
$setupRequired = auth_setup_required(auth_db());

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
    $fullNameInput = trim((string) ($_POST['full_name'] ?? ''));
    $usernameInput = trim((string) ($_POST['username'] ?? ''));
    $passwordInput = (string) ($_POST['password'] ?? '');
    $passwordConfirmInput = (string) ($_POST['password_confirm'] ?? '');
    $csrfToken = (string) ($_POST['csrf_token'] ?? '');

    if (!auth_csrf_valid($csrfToken)) {
        $errorMessage = 'Your session expired. Please try signing in again.';
    } elseif ($setupRequired) {
        if ($fullNameInput === '' || $usernameInput === '' || $passwordInput === '' || $passwordConfirmInput === '') {
            $errorMessage = 'Complete all fields to create the first captain account.';
        } elseif ($passwordInput !== $passwordConfirmInput) {
            $errorMessage = 'Passwords do not match.';
        } else {
            try {
                auth_create_initial_captain($fullNameInput, $usernameInput, $passwordInput);
                $result = auth_attempt_login($usernameInput, $passwordInput);
                if (($result['success'] ?? false) === true && is_array($result['user'] ?? null)) {
                    $loggedInUser = $result['user'];
                    auth_redirect(auth_user_home($loggedInUser));
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
        try {
            $result = auth_attempt_login($usernameInput, $passwordInput);
            if (($result['success'] ?? false) === true && is_array($result['user'] ?? null)) {
                $loggedInUser = $result['user'];
                auth_redirect(auth_user_home($loggedInUser));
            }
            $errorMessage = (string) ($result['error'] ?? 'Unable to sign in right now.');
        } catch (Throwable $exception) {
            $errorMessage = 'Unable to connect to authentication service. Please try again.';
        }
    }

    $setupRequired = auth_setup_required(auth_db());
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
$loginStyleVersion = @filemtime(__DIR__ . '/assets/css/login-style.css');
$loginStyleHref = 'assets/css/login-style.css' . ($loginStyleVersion ? '?v=' . rawurlencode((string) $loginStyleVersion) : '');
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> - Login</title>

  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="<?= htmlspecialchars($loginStyleHref, ENT_QUOTES, 'UTF-8') ?>">
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
        <div class="form-head">
          <span class="eyebrow"><?= $setupRequired ? 'System Setup' : 'Welcome back' ?></span>
          <h2><?= $setupRequired ? 'Create the first captain account' : 'Sign in to your account' ?></h2>
          <p><?= $setupRequired ? 'No user accounts exist yet. Complete the secure first-time setup before going online.' : 'Use your assigned credentials to continue.' ?></p>
        </div>

        <form id="loginForm" class="login-form" autocomplete="on" method="post" action="login.php" data-mode="<?= $setupRequired ? 'setup' : 'login' ?>" novalidate>
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
        </form>
      </section>
    </div>
  </div>

  <footer>
    &copy; <?php echo date('Y'); ?> <?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?> | All Rights Reserved
  </footer>

  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/login-scripts.js"></script>
</body>
</html>




