(function () {
  const CACHE_PREFIX = "registration-module-";
  const SERVICE_WORKER_URL = "service-worker.js";
  const SERVICE_WORKER_SCOPE = "./";

  if (!("serviceWorker" in navigator)) {
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
      url: new URL("registration.php", window.location.href).toString()
    }),
    postToWorker({
      type: "CACHE_CURRENT_ROUTE",
      url: new URL("member.php", window.location.href).toString()
    })
  ]);

  window.clearRegistrationOfflineCaches = async function clearRegistrationOfflineCaches() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => String(registration.scope || "").startsWith(new URL(SERVICE_WORKER_SCOPE, window.location.href).href))
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
  }).then((registration) => {
    const waitingWorker = registration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    return warmRegistrationRoutes();
  }).catch(() => {
    // Ignore registration failures when the browser does not allow service workers.
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    void warmRegistrationRoutes();
  });
})();
