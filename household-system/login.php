<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$existingUser = auth_current_user();
if (is_array($existingUser)) {
    auth_redirect(auth_role_home(auth_user_role($existingUser)));
}

$usernameInput = '';
$errorMessage = '';

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
    $usernameInput = trim((string) ($_POST['username'] ?? ''));
    $passwordInput = (string) ($_POST['password'] ?? '');
    $csrfToken = (string) ($_POST['csrf_token'] ?? '');

    if (!auth_csrf_valid($csrfToken)) {
        $errorMessage = 'Your session expired. Please try signing in again.';
    } else {
        try {
            $result = auth_attempt_login($usernameInput, $passwordInput);
            if (($result['success'] ?? false) === true && is_array($result['user'] ?? null)) {
                $loggedInUser = $result['user'];
                auth_redirect(auth_role_home(auth_user_role($loggedInUser)));
            }
            $errorMessage = (string) ($result['error'] ?? 'Unable to sign in right now.');
        } catch (Throwable $exception) {
            $errorMessage = 'Unable to connect to authentication service. Please try again.';
        }
    }
}

$csrfToken = auth_csrf_token();
$brandBarangay = trim(auth_env(['BARANGAY_NAME'], 'Barangay'));
$brandCity = trim(auth_env(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], ''));
$brandLabel = $brandBarangay !== '' ? $brandBarangay : 'Barangay';
$accessAreaLabel = $brandCity !== '' ? $brandCity : $brandLabel;
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> - Login</title>

  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/login-style.css">
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
          <div>
            <div class="brand-title"><?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?></div>
            <div class="brand-sub">Household Information Management System</div>
          </div>
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
          <span class="eyebrow">Welcome back</span>
          <h2>Sign in to your account</h2>
          <p>Use your assigned credentials to continue.</p>
        </div>

        <form id="loginForm" class="login-form" autocomplete="on" method="post" action="login.php" novalidate>
          <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">

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
              <input type="password" id="password" name="password" class="form-control" placeholder="Enter your password" autocomplete="current-password" required>
            </div>
          </div>

          <div id="error" class="form-error<?php echo $errorMessage !== '' ? ' is-visible' : ''; ?>" role="alert" aria-live="polite">
            <?php echo htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'); ?>
          </div>

          <button id="loginBtn" class="btn btn-primary w-100" type="submit">Sign In</button>
        </form>
      </section>
    </div>
  </div>

  <footer>
    &copy; <?php echo date('Y'); ?> <?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> | All Rights Reserved
  </footer>

  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/login-scripts.js"></script>
</body>
</html>




