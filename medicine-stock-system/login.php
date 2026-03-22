<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
mss_page_redirect_if_authenticated();
$loginCssVersion = (string) @filemtime(__DIR__ . '/assets/css/login-style.css');
$loginJsVersion = (string) @filemtime(__DIR__ . '/assets/js/login-scripts.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ligao City Coastal RHU - Login</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/login-style.css?v=<?= urlencode($loginCssVersion) ?>">
</head>
<body>
  <div class="page">
    <div class="login-shell">
      <section class="brand-panel reveal delay-1">
        <div class="brand-badge">
          <i class="bi bi-shield-lock-fill"></i>
          Admin &amp; Staff Access
        </div>
        <div class="brand-mark">
          <div class="brand-main">
            <img class="brand-main-logo" src="assets/img/CityHealthOffice_LOGO.png" alt="Ligao City Coastal Rural Health Unit Logo">
            <div class="brand-copy">
              <div class="brand-title">Ligao City Coastal RHU</div>
              <div class="brand-sub">Cabarian, Ligao City</div>
            </div>
          </div>
          <img class="brand-side-logo" src="assets/img/ligao-city-logo.png" alt="Ligao City Logo">
        </div>
        <p class="brand-desc">
          Secure access for authorized personnel of Ligao City Coastal Rural Health Unit.
          Track medicine availability, monitor expiration, and maintain reliable stock levels
          for community health services in Cabarian, Ligao City.
        </p>
        <div class="brand-logos">
          <img src="assets/img/CityHealthOffice_LOGO.png" alt="Ligao City Coastal Rural Health Unit Logo">
          <img src="assets/img/ligao-city-logo.png" alt="Ligao City Logo">
          <img src="assets/img/barangay-cabarian-logo.png" alt="Barangay Cabarian Logo">
        </div>
        <div class="brand-note">
          <i class="bi bi-shield-check"></i>
          Authorized Personnel Only
        </div>
      </section>

      <section class="form-panel reveal delay-2">
        <div class="form-head">
          <span class="eyebrow" id="loginEyebrow">Welcome back</span>
          <h2 id="loginTitle">Sign in as Admin or Staff</h2>
          <p id="loginDescription">Use your assigned admin or staff credentials to continue.</p>
        </div>

        <form id="loginForm" class="login-form" autocomplete="on" novalidate>
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

          <div class="field d-none" id="confirmPasswordField">
            <label for="confirmPassword">Confirm Password</label>
            <div class="input-wrap">
              <i class="bi bi-shield-lock"></i>
              <input type="password" id="confirmPassword" name="confirm_password" class="form-control" placeholder="Confirm your password" autocomplete="new-password">
            </div>
          </div>

          <p class="small text-muted d-none mb-0" id="setupHint">
            First-time setup: create the admin username and password first. Staff accounts can be added after admin setup.
          </p>

          <div id="error" class="form-error" role="alert" aria-live="polite"></div>

          <button id="loginBtn" class="btn btn-primary w-100" type="submit">Sign In</button>
        </form>
      </section>

      <footer class="login-footer">
        &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System | All Rights Reserved
      </footer>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/login-scripts.js?v=<?= urlencode($loginJsVersion) ?>"></script>
</body>
</html>
