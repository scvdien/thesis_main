<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$currentUser = auth_current_user();
if (is_array($currentUser)) {
    auth_audit_log([
        'user' => $currentUser,
        'action_key' => 'logout',
        'action_type' => 'access',
        'module_name' => 'Authentication',
        'record_type' => 'session',
        'record_id' => (string) ($currentUser['username'] ?? ''),
        'details' => 'User logged out.',
    ]);
}

auth_logout();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0;url=login.php">
    <title>Signing Out</title>
</head>
<body>
<script>
(async function () {
  const moduleScopeUrl = new URL("./", window.location.href).href;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => String(registration.scope || "").startsWith(moduleScopeUrl))
          .map((registration) => registration.unregister())
      );
    }
  } catch (error) {
    // Ignore service worker cleanup failures.
  }

  try {
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((cacheKey) => cacheKey.startsWith("registration-module-"))
          .map((cacheKey) => caches.delete(cacheKey))
      );
    }
  } catch (error) {
    // Ignore cache cleanup failures.
  }

  window.location.replace("login.php");
})();
</script>
<noscript>
    <p>Signing out. If you are not redirected, <a href="login.php">continue to login</a>.</p>
</noscript>
</body>
</html>
