<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$currentUser = auth_current_user();
$signedOutUserId = (int) ($currentUser['id'] ?? 0);
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
    auth_revoke_offline_reauth_token((int) ($currentUser['id'] ?? 0));
}

auth_logout();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Signing Out</title>
    <link rel="icon" type="image/png" href="assets/img/barangay-cabarian-logo.png">
</head>
<body>
<script>
(async function () {
  const moduleScopeUrl = new URL("./", window.location.href).href;
  const signedOutUserId = <?= json_encode((string) $signedOutUserId, JSON_UNESCAPED_SLASHES) ?>;
  const ownerField = "local_owner_user_id";
  const offlineArrayKeys = [
    "household_registration_records",
    "household_registration_years_cache"
  ];

  const filterOfflineArray = (rawValue, key) => {
    try {
      const items = JSON.parse(String(rawValue || "[]"));
      if (!Array.isArray(items)) return null;
      return items.filter((item) => {
        if (String(item?.[ownerField] || "").trim() !== signedOutUserId) return true;
        if (key === "household_registration_years_cache") return false;
        return item?.offline_snapshot !== true;
      });
    } catch {
      return null;
    }
  };

  const clearBulkOfflineData = async () => {
    if (!signedOutUserId || signedOutUserId === "0") return;

    try {
      offlineArrayKeys.forEach((key) => {
        const rawValue = window.localStorage.getItem(key);
        if (rawValue === null) return;
        const filtered = filterOfflineArray(rawValue, key);
        if (!filtered) return;
        if (filtered.length > 0) {
          window.localStorage.setItem(key, JSON.stringify(filtered));
        } else {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      // Continue with IndexedDB cleanup when localStorage is unavailable.
    }

    if (!("indexedDB" in window)) return;
    await new Promise((resolve) => {
      const request = window.indexedDB.open("thesis_main_offline_db");
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.close();
          resolve();
          return;
        }

        const transaction = db.transaction("kv", "readwrite");
        const store = transaction.objectStore("kv");
        offlineArrayKeys.forEach((key) => {
          const getRequest = store.get(key);
          getRequest.onsuccess = () => {
            if (getRequest.result === undefined || getRequest.result === null) return;
            const filtered = filterOfflineArray(getRequest.result, key);
            if (!filtered) return;
            if (filtered.length > 0) {
              store.put(JSON.stringify(filtered), key);
            } else {
              store.delete(key);
            }
          };
        });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          resolve();
        };
        transaction.onabort = () => {
          db.close();
          resolve();
        };
      };
    });
  };

  await clearBulkOfflineData();

  try {
    window.sessionStorage.removeItem("cabarian_session_authenticated");
    window.sessionStorage.removeItem("cabarian_offline_session_active");
  } catch (error) {
    // Continue logout when browser storage is unavailable.
  }

  try {
    if ("caches" in window) {
      const authStateCache = await caches.open("registration-module-auth-state");
      const loggedOutUrl = new URL(".registration-logged-out", moduleScopeUrl).toString();
      await authStateCache.put(loggedOutUrl, new Response("logged-out", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }));
    }
  } catch (error) {
    // Ignore cache marker failures.
  }

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "PREPARE_LOGOUT" });
    }
  } catch (error) {
    // Ignore message failures.
  }

  window.location.replace("login.php");
})();
</script>
<noscript>
    <p>Signing out. If you are not redirected, <a href="login.php">continue to login</a>.</p>
</noscript>
</body>
</html>
