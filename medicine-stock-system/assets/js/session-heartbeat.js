(() => {
  const HEARTBEAT_ENDPOINT = "auth-api.php";
  const HEARTBEAT_INTERVAL_MS = 45000;
  const pathname = window.location.pathname.split("/").pop() || "";
  const locationLabels = {
    "index.php": "Admin Dashboard",
    "settings.php": "Settings Module",
    "staff.php": "Staff Dashboard",
    "medicine-inventory.php": "Medicine Inventory",
    "cho-request-log.php": "CHO Request Log",
    "dispensing-records.php": "Dispensing Records",
    "resident-medication-records.php": "Dispensing Records",
    "reports.php": "Reports",
    "notifications.php": "Notifications"
  };

  let heartbeatTimer = 0;

  const heartbeatLocation = locationLabels[pathname] || "Medicine Stock Module";

  const sendHeartbeat = async () => {
    const url = new URL(HEARTBEAT_ENDPOINT, window.location.href);
    url.searchParams.set("t", String(Date.now()));
    url.searchParams.set("location", heartbeatLocation);

    try {
      await fetch(url.toString(), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
    } catch (_error) {
      // Ignore heartbeat failures and retry on the next interval.
    }
  };

  const startHeartbeat = () => {
    void sendHeartbeat();

    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
    }

    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void sendHeartbeat();
    }
  });

  window.addEventListener("pageshow", () => {
    void sendHeartbeat();
  });

  startHeartbeat();
})();
