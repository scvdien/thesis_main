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
  const REQUIRED_ROUTE_URLS = [REGISTRATION_URL, MEMBER_URL];
  const OFFLINE_NOTICE_ID = "registrationOfflineSetupNotice";
  const OFFLINE_STATUS_EVENT = "registration-offline-status";
  const MEMBER_WARMUP_HASH = "#registration-member-cache-warmup";
  const WORKER_MESSAGE_TIMEOUT_MS = 30000;
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  let routeWarmupSequence = 0;
  let memberNavigationWarmPromise = null;
  let memberNavigationWarmController = null;

  if (window.self !== window.top && window.location.hash === MEMBER_WARMUP_HASH) {
    return;
  }

  const dispatchOfflineStatus = (detail) => {
    const status = {
      state: "idle",
      tone: "warning",
      visible: false,
      message: "",
      ...detail
    };

    renderOfflineNotice(status);
    window.dispatchEvent(new CustomEvent(OFFLINE_STATUS_EVENT, {
      detail: status
    }));

    return status;
  };

  const findOfflineNoticeAnchor = () => {
    const contentHeader = document.querySelector(".content-header");
    if (contentHeader) {
      return { anchor: contentHeader, placement: "afterend" };
    }

    const pageHeader = document.querySelector(".page-header");
    if (pageHeader) {
      return { anchor: pageHeader, placement: "afterend" };
    }

    const pageWrap = document.querySelector(".page-wrap");
    if (pageWrap) {
      return { anchor: pageWrap, placement: "afterbegin" };
    }

    const layout = document.querySelector(".layout");
    if (layout) {
      return { anchor: layout, placement: "afterbegin" };
    }

    return { anchor: document.body, placement: "afterbegin" };
  };

  const ensureOfflineNoticeElement = () => {
    let notice = document.getElementById(OFFLINE_NOTICE_ID);
    if (notice) {
      return notice;
    }

    notice = document.createElement("div");
    notice.id = OFFLINE_NOTICE_ID;
    notice.className = "alert alert-warning d-none mb-3";
    notice.setAttribute("role", "alert");
    notice.setAttribute("aria-live", "polite");

    const { anchor, placement } = findOfflineNoticeAnchor();
    if (placement === "afterend") {
      anchor.insertAdjacentElement("afterend", notice);
    } else {
      anchor.insertAdjacentElement("afterbegin", notice);
    }

    return notice;
  };

  const renderOfflineNotice = (status) => {
    const notice = ensureOfflineNoticeElement();
    const shouldShow = Boolean(status.visible && String(status.message || "").trim() !== "");

    notice.className = "alert d-none mb-3";
    notice.textContent = "";

    if (!shouldShow) {
      return;
    }

    const safeTone = status.tone === "danger"
      ? "danger"
      : status.tone === "success"
        ? "success"
        : "warning";

    notice.className = `alert alert-${safeTone} mb-3`;
    notice.textContent = String(status.message || "").trim();
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
    dispatchOfflineStatus({
      state: "unsupported",
      tone: "warning",
      visible: true,
      message: "This browser does not support service workers, so offline install and page caching are unavailable."
    });
    return;
  }

  if (offlineRequiresHttps()) {
    dispatchOfflineStatus({
      state: "insecure",
      tone: "warning",
      visible: true,
      message: "Offline mode and app install require HTTPS on hosted sites. Enable SSL in Hostinger and reload this page."
    });
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
      frame.src = `${MEMBER_URL}${MEMBER_WARMUP_HASH}`;
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
      MEMBER_URL
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
        void postRouteWarmupWithoutReply(REQUIRED_ROUTE_URLS);
      }

      const routeResults = Array.isArray(result.results) ? result.results : [];
      const status = dispatchOfflineStatus({
        state: requiredRoutesReady ? "ready" : "partial",
        tone: requiredRoutesReady ? "success" : "warning",
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
      state: "error",
      tone: "warning",
      visible: true,
      message: getRegistrationErrorMessage(error)
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    retryRouteWarmup();
  });

  window.addEventListener("online", retryRouteWarmup);
})();
