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
  const OFFLINE_NOTICE_ID = "registrationOfflineSetupNotice";
  const OFFLINE_STATUS_EVENT = "registration-offline-status";
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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

  const postToWorker = async (message) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active || navigator.serviceWorker.controller;
      if (worker) {
        worker.postMessage(message);
      }
    } catch (error) {
      // Ignore service worker messaging errors.
    }
  };

  const cacheCurrentRoute = () => postToWorker({
    type: "CACHE_CURRENT_ROUTE",
    url: window.location.href
  });

  const warmRegistrationRoutes = () => Promise.allSettled([
    cacheCurrentRoute(),
    postToWorker({
      type: "CACHE_CURRENT_ROUTE",
      url: REGISTRATION_URL
    }),
    postToWorker({
      type: "CACHE_CURRENT_ROUTE",
      url: MEMBER_URL
    })
  ]);

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
    scope: SERVICE_WORKER_SCOPE
  }).then(async (registration) => {
    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }

    dispatchOfflineStatus({
      state: "ready",
      tone: "success",
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
    void warmRegistrationRoutes();
  });
})();
