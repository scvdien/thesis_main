(function () {
  const CACHE_PREFIX = "registration-module";
  const APP_BASE_URL = new URL("./", window.location.href);
  const SERVICE_WORKER_URL = new URL("service-worker.js", APP_BASE_URL).toString();
  const SERVICE_WORKER_SCOPE_URL = new URL("./", APP_BASE_URL);
  const SERVICE_WORKER_SCOPE = SERVICE_WORKER_SCOPE_URL.pathname.endsWith("/")
    ? SERVICE_WORKER_SCOPE_URL.pathname
    : `${SERVICE_WORKER_SCOPE_URL.pathname}/`;
  const REGISTRATION_URL = new URL("registration.php", APP_BASE_URL).toString();
  const MEMBER_URL = new URL("member.php", APP_BASE_URL).toString();
  const LOGIN_URL = new URL("login.php", APP_BASE_URL).toString();
  const REQUIRED_ROUTE_URLS = [REGISTRATION_URL, MEMBER_URL, LOGIN_URL];
  const OFFLINE_NOTICE_ID = "registrationOfflineSetupNotice";
  const OFFLINE_STATUS_EVENT = "registration-offline-status";
  const MEMBER_WARMUP_HASH = "#registration-member-cache-warmup";
  const WORKER_MESSAGE_TIMEOUT_MS = 30000;
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  let routeWarmupSequence = 0;
  let memberNavigationWarmPromise = null;
  let memberNavigationWarmController = null;

  try {
    const role = document.body.dataset.role || "";
    const username = document.body.dataset.currentUsername || "";
    const userId = document.body.dataset.currentUserId || "";
    const reauthToken = document.body.dataset.offlineReauthToken || "";
    if (username) {
      window.localStorage.setItem("cabarian_authenticated_staff", JSON.stringify({
        username: username.toLowerCase(),
        userId,
        role: role || "staff",
        reauthToken,
        savedAt: Date.now()
      }));

      let staffAuth = null;
      try {
        const raw = window.localStorage.getItem("cabarian_offline_staff_auth");
        staffAuth = raw ? JSON.parse(raw) : null;
      } catch {}

      if (!staffAuth || typeof staffAuth !== "object") {
        staffAuth = { username: username.toLowerCase() };
      }

      staffAuth.username = username.toLowerCase();
      staffAuth.userId = userId || staffAuth.userId || "";
      staffAuth.role = role || staffAuth.role || "staff";
      staffAuth.reauthToken = reauthToken || staffAuth.reauthToken || "";
      staffAuth.savedAt = Date.now();

      try {
        const rawStaging = window.localStorage.getItem("cabarian_offline_auth_staging");
        if (rawStaging) {
          const staging = JSON.parse(rawStaging);
          if (staging && staging.passwordHash) {
            staffAuth.passwordHash = staging.passwordHash;
          }
          window.localStorage.removeItem("cabarian_offline_auth_staging");
        }
      } catch {}

      window.localStorage.setItem("cabarian_offline_staff_auth", JSON.stringify(staffAuth));
    }
  } catch {}

  try {
    window.CabarianOfflineAccess = {
      read: () => {
        try {
          const raw = window.localStorage.getItem("cabarian_offline_staff_auth")
            || window.localStorage.getItem("cabarian_authenticated_staff");
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed && parsed.username && (parsed.reauthToken || parsed.reauth_token) ? {
            username: String(parsed.username || "").toLowerCase().trim(),
            userId: String(parsed.userId || parsed.user_id || "").trim(),
            role: String(parsed.role || "staff").trim(),
            reauthToken: String(parsed.reauthToken || parsed.reauth_token || "").trim()
          } : null;
        } catch {
          return null;
        }
      },
      clear: () => {
        try {
          window.localStorage.removeItem("cabarian_offline_staff_auth");
          window.localStorage.removeItem("cabarian_authenticated_staff");
        } catch {}
      }
    };
  } catch {}

  const renderOfflineNotice = () => {
    const notice = document.getElementById(OFFLINE_NOTICE_ID);
    if (notice) {
      notice.remove();
    }
  };

  const dispatchOfflineStatus = (detail) => {
    const status = {
      state: "idle",
      tone: "warning",
      visible: false,
      message: "",
      ...detail
    };

    renderOfflineNotice();
    window.dispatchEvent(new CustomEvent(OFFLINE_STATUS_EVENT, {
      detail: status
    }));

    return status;
  };

  const isLocalDevelopmentHost = () => {
    return LOCAL_HOSTS.has(window.location.hostname);
  };

  const offlineRequiresHttps = () => {
    return !window.isSecureContext && !isLocalDevelopmentHost();
  };

  const getRegistrationErrorMessage = (error) => {
    const errorMessage = String(error && error.message ? error.message : "").toLowerCase();

    if (offlineRequiresHttps() || errorMessage.includes("insecure") || errorMessage.includes("secure")) {
      return "Offline mode and app install require HTTPS on hosted sites. Enable SSL in Hostinger and reload this page.";
    }

    if (errorMessage.includes("scope") || errorMessage.includes("scripturl")) {
      return "Offline setup could not match the current app folder. Keep the household system in one hosting subfolder, then reload.";
    }

    return "Offline setup could not be initialized. Check the hosted service worker path and HTTPS configuration, then reload.";
  };

  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (offlineRequiresHttps()) {
    return;
  }

  const postToWorkerWithReply = async (message) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) {
      throw new Error("No active service worker is available.");
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeoutId = window.setTimeout(() => {
        channel.port1.close();
        reject(new Error("Offline route caching timed out."));
      }, WORKER_MESSAGE_TIMEOUT_MS);

      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeoutId);
        channel.port1.close();
        resolve(event.data && typeof event.data === "object" ? event.data : {
          success: false,
          results: []
        });
      };

      worker.postMessage(message, [channel.port2]);
    });
  };

  const postRouteWarmupWithoutReply = async (urls = []) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      if (!worker) return;
      (Array.isArray(urls) ? urls : []).forEach((url) => {
        worker.postMessage({
          type: "CACHE_CURRENT_ROUTE",
          url: String(url || "")
        });
      });
    } catch {
      // The acknowledged warm-up below remains the primary path.
    }
  };

  const prewarmMemberPageThroughNavigation = async () => {
    if (window.navigator.onLine === false) {
      return false;
    }
    const currentRole = String(document.body?.dataset?.role || "").trim().toLowerCase();
    if (currentRole && !["staff", "secretary", "admin"].includes(currentRole)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const handleControllerChange = () => {
          window.clearTimeout(timeoutId);
          resolve();
        };
        const timeoutId = window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
          resolve();
        }, 3000);
        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange, { once: true });
      });
    }

    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) return false;
    if (memberNavigationWarmPromise && memberNavigationWarmController === worker) {
      return memberNavigationWarmPromise;
    }

    const navigationPromise = new Promise((resolve) => {
      const frame = document.createElement("iframe");
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        frame.remove();
        resolve(Boolean(success));
      };
      const timeoutId = window.setTimeout(() => finish(false), 15000);
      frame.title = "Preparing Add Member for offline use";
      frame.tabIndex = -1;
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;bottom:0;border:0;opacity:0;pointer-events:none;";
      frame.addEventListener("load", () => finish(true), { once: true });
      frame.addEventListener("error", () => finish(false), { once: true });
      frame.src = MEMBER_URL;
      (document.body || document.documentElement).appendChild(frame);
    }).catch(() => false);

    const trackedPromise = navigationPromise.finally(() => {
      if (memberNavigationWarmPromise === trackedPromise) {
        memberNavigationWarmPromise = null;
        memberNavigationWarmController = null;
      }
    });
    memberNavigationWarmController = worker;
    memberNavigationWarmPromise = trackedPromise;
    return trackedPromise;
  };

  const getRoutePageName = (value) => {
    try {
      const pathname = new URL(String(value || ""), APP_BASE_URL).pathname;
      return String(pathname.split("/").pop() || "").trim().toLowerCase();
    } catch {
      return "";
    }
  };

  const hasRequiredRoutes = (results = []) => {
    const cachedPageNames = new Set(
      (Array.isArray(results) ? results : [])
        .filter((item) => item?.success === true)
        .map((item) => getRoutePageName(item?.url))
        .filter(Boolean)
    );
    return REQUIRED_ROUTE_URLS.every((url) => cachedPageNames.has(getRoutePageName(url)));
  };

  const warmRegistrationRoutes = async () => {
    const warmupSequence = ++routeWarmupSequence;
    const urls = Array.from(new Set([
      window.location.href,
      REGISTRATION_URL,
      MEMBER_URL,
      LOGIN_URL
    ]));
    try {
      await prewarmMemberPageThroughNavigation();
      if (warmupSequence !== routeWarmupSequence) {
        return { success: false, results: [], stale: true };
      }
      let result = { success: false, results: [] };
      let requiredRoutesReady = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        result = await postToWorkerWithReply({
          type: "WARM_REGISTRATION_ROUTES",
          urls: attempt === 0 ? urls : REQUIRED_ROUTE_URLS,
          preferCached: true
        });
        if (warmupSequence !== routeWarmupSequence) {
          return { ...result, stale: true };
        }
        requiredRoutesReady = hasRequiredRoutes(result.results);
        if (requiredRoutesReady || window.navigator.onLine === false) break;
        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }
      if (!requiredRoutesReady && window.navigator.onLine !== false) {
        void postRouteWarmupWithoutReply([...REQUIRED_ROUTE_URLS, LOGIN_URL]);
      }

      const routeResults = Array.isArray(result.results) ? result.results : [];
      let offlineAccessReady = false;
      try {
        const raw = window.localStorage.getItem("cabarian_offline_staff_auth") || window.localStorage.getItem("cabarian_authenticated_staff");
        offlineAccessReady = Boolean(raw && JSON.parse(raw)?.username);
      } catch {}
      const fullyReady = requiredRoutesReady && offlineAccessReady;
      const status = dispatchOfflineStatus({
        state: fullyReady ? "ready" : "partial",
        tone: fullyReady ? "success" : "warning",
        visible: false,
        message: "",
        routeResults
      });
      window.registrationOfflineWarmupResult = status;
      return status;
    } catch (error) {
      if (warmupSequence !== routeWarmupSequence) {
        return { success: false, results: [], stale: true };
      }

      const status = dispatchOfflineStatus({
        state: "partial",
        tone: "warning",
        visible: false,
        message: "",
        routeResults: []
      });
      window.registrationOfflineWarmupResult = status;
      return status;
    }
  };

  const retryRouteWarmup = () => {
    void warmRegistrationRoutes();
  };

  window.clearRegistrationOfflineCaches = async function clearRegistrationOfflineCaches() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => String(registration.scope || "").startsWith(SERVICE_WORKER_SCOPE_URL.href))
          .map((registration) => registration.unregister())
      );
    } catch (error) {
      // Ignore unregister failures.
    }

    try {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((cacheKey) => cacheKey.startsWith(CACHE_PREFIX))
          .map((cacheKey) => caches.delete(cacheKey))
      );
    } catch (error) {
      // Ignore cache cleanup failures.
    }
  };

  navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    scope: SERVICE_WORKER_SCOPE,
    updateViaCache: "none"
  }).then(async (registration) => {
    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }

    dispatchOfflineStatus({
      state: "warming",
      tone: "warning",
      visible: false
    });

    await warmRegistrationRoutes();
  }).catch((error) => {
    dispatchOfflineStatus({
      state: "idle",
      tone: "warning",
      visible: false,
      message: ""
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    retryRouteWarmup();
  });

  window.addEventListener("online", retryRouteWarmup);
})();
