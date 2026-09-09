const CACHE_PREFIX = "registration-module";
const CACHE_VERSION = "2026-09-08-v58";
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const PAGE_CACHE_NAME = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const AUTH_STATE_CACHE_NAME = `${CACHE_PREFIX}-auth-state`;
const APP_SCOPE_URL = new URL(self.registration.scope);
const APP_SCOPE_PATH = APP_SCOPE_URL.pathname.endsWith("/")
  ? APP_SCOPE_URL.pathname
  : `${APP_SCOPE_URL.pathname}/`;
const buildScopedUrl = (path = "") => new URL(path, APP_SCOPE_URL).toString();
const OFFLINE_FALLBACK_URL = buildScopedUrl("offline-registration.html");
const LOGGED_OUT_STATE_URL = buildScopedUrl(".registration-logged-out");
const REQUIRED_OFFLINE_PAGE_URLS = [
  "registration.php",
  "registration.php?sw_cache=1",
  "member.php",
  "member.php?sw_cache=1",
  "login.php",
  "login.php?sw_cache=1"
].map((path) => buildScopedUrl(path));
const PRECACHE_URLS = [
  "offline-registration.html",
  "manifest.webmanifest",
  "bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css",
  "bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js",
  "assets/vendor/bootstrap-icons/bootstrap-icons.css",
  "assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2",
  "assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff",
  "assets/css/registration-style.css",
  "assets/css/password-toggle.css",
  "assets/css/site-style.css",
  "assets/css/household-view.css",
  "assets/js/indexeddb-storage-scripts.js",
  "assets/js/registration-offline-init.js",
  "assets/js/registration-photo-storage.js",
  "assets/js/photo-capture.js",
  "assets/js/registration-scripts.js",
  "assets/js/password-toggle.js",
  "assets/js/member-scripts.js",
  "assets/js/households-scripts.js",
  "assets/js/household-view.js",
  "assets/js/responsive-table-scripts.js",
  "assets/img/registration-app-icon-192.png",
  "assets/img/registration-app-icon-512.png",
  "assets/img/registration-app-icon-maskable-512.png",
  "assets/img/barangay-cabarian-logo.png",
  "assets/img/ligao-city-logo.png",
  "assets/js/login-scripts.js",
  "assets/css/login-style.css"
].map((path) => buildScopedUrl(path));
const REGISTRATION_PAGE_NAMES = new Set([
  "registration.php",
  "member.php",
  "households.php",
  "household-view.php",
  "login.php",
  "logout.php",
  "offline-registration.html"
]);
const AUTHENTICATED_PAGE_NAMES = new Set([
  "registration.php",
  "member.php",
  "households.php",
  "household-view.php"
]);
const BYPASS_PAGE_NAMES = new Set([
  "registration-sync.php",
  "registration-photo.php",
  "users-api.php",
  "auth-presence.php",
  "auto-reauth-api.php",
  "offline-enrollment-api.php"
]);
const ASSET_PATH_PATTERN = /\.(?:css|js|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf)$/i;

const getUrl = (input) => new URL(typeof input === "string" ? input : input.url, APP_SCOPE_URL);
const getPageName = (input) => {
  const url = getUrl(input);
  const segments = url.pathname.split("/");
  return String(segments.pop() || "").trim().toLowerCase();
};

const isSameOriginGet = (request) => request.method === "GET" && getUrl(request).origin === APP_SCOPE_URL.origin;
const isRegistrationNavigation = (request) => request.mode === "navigate" && REGISTRATION_PAGE_NAMES.has(getPageName(request));
const isBypassedRequest = (request) => BYPASS_PAGE_NAMES.has(getPageName(request));
const isAssetRequest = (request) => ASSET_PATH_PATTERN.test(getUrl(request).pathname);
const isRegistrationPhotoRequest = (request) => getPageName(request) === "registration-photo.php";

const normalizedAssetKey = (request) => {
  const url = getUrl(request);
  if (getPageName(request) === "registration-photo.php") {
    url.hash = "";
    return url.toString();
  }
  url.search = "";
  url.hash = "";
  return url.toString();
};

const clearRegistrationCaches = async () => {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  );
};

const markLoggedOut = async () => {
  const authStateCache = await caches.open(AUTH_STATE_CACHE_NAME);
  await authStateCache.put(LOGGED_OUT_STATE_URL, new Response("logged-out", {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  }));
};

const clearLoggedOutState = async () => {
  const authStateCache = await caches.open(AUTH_STATE_CACHE_NAME);
  const keys = await authStateCache.keys();
  await Promise.all(keys.map((key) => authStateCache.delete(key)));
  try {
    await authStateCache.delete(LOGGED_OUT_STATE_URL);
  } catch {}
};

const isMarkedLoggedOut = async () => {
  const authStateCache = await caches.open(AUTH_STATE_CACHE_NAME);
  const keys = await authStateCache.keys();
  return keys.length > 0;
};

const cachePageResponse = async (request, response) => {
  const responseUrl = response && response.url ? response.url : request.url;
  const requestedPageName = getPageName(request);
  const responsePageName = getPageName(responseUrl);
  if (
    !response
    || !response.ok
    || (!REGISTRATION_PAGE_NAMES.has(requestedPageName) && !REGISTRATION_PAGE_NAMES.has(responsePageName))
  ) {
    return false;
  }

  // Prevent cache poisoning: if a request for registration.php or member.php was redirected to login.php,
  // do NOT save it under registration.php or member.php!
  if (responsePageName === "login.php" && requestedPageName !== "login.php") {
    const pageCache = await caches.open(PAGE_CACHE_NAME);
    await pageCache.put(buildScopedUrl("login.php"), response.clone());
    return false;
  }

  // If this is an authenticated page, verify that the response does not contain login form HTML
  if (AUTHENTICATED_PAGE_NAMES.has(requestedPageName) || AUTHENTICATED_PAGE_NAMES.has(responsePageName)) {
    try {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      if (text.includes('id="loginForm"') || text.includes('id="loginBtn"')) {
        const pageCache = await caches.open(PAGE_CACHE_NAME);
        await pageCache.put(buildScopedUrl("login.php"), response.clone());
        return false;
      }
    } catch {}
    await clearLoggedOutState();
  }

  const pageCache = await caches.open(PAGE_CACHE_NAME);
  await pageCache.put(request, response.clone());

  if (requestedPageName === "member.php" || responsePageName === "member.php") {
    await pageCache.put(buildScopedUrl("member.php"), response.clone());
  }
  if (requestedPageName === "registration.php" || responsePageName === "registration.php") {
    await pageCache.put(buildScopedUrl("registration.php"), response.clone());
  }
  if (requestedPageName === "login.php" || responsePageName === "login.php") {
    try {
      const htmlText = await response.clone().text();
      const sanitizedHtml = htmlText.replace(
        /(name=["']csrf_token["']\s+value=["'])[^"']*([ "'])/gi,
        '$1offline-token$2'
      );
      const sanitizedResponse = new Response(sanitizedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
      await pageCache.put(buildScopedUrl("login.php"), sanitizedResponse);
      return true;
    } catch {}
    await pageCache.put(buildScopedUrl("login.php"), response.clone());
  }

  return true;
};

const getRegistrationPageCandidates = (request) => {
  const requestUrl = getUrl(request);
  const candidates = [request, request.url];
  const canonicalUrl = new URL(requestUrl.toString());
  canonicalUrl.search = "";
  canonicalUrl.hash = "";
  if (!candidates.includes(canonicalUrl.toString())) {
    candidates.push(canonicalUrl.toString());
  }
  const pageName = getPageName(requestUrl);
  if (pageName) {
    const cleanScoped = buildScopedUrl(pageName);
    if (!candidates.includes(cleanScoped)) {
      candidates.push(cleanScoped);
    }
  }
  return candidates;
};

const findCachedRegistrationPage = async (request) => {
  const candidates = getRegistrationPageCandidates(request);
  const targetPageName = getPageName(request);
  const isAuthPage = AUTHENTICATED_PAGE_NAMES.has(targetPageName);

  const isValidMatch = async (cachedResponse) => {
    if (!cachedResponse || !cachedResponse.ok) return false;
    if (isAuthPage) {
      try {
        const text = await cachedResponse.clone().text();
        if (text.includes('id="loginForm"') || text.includes('id="loginBtn"')) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  };

  const pageCache = await caches.open(PAGE_CACHE_NAME);
  for (const candidate of candidates) {
    const cached = await pageCache.match(candidate);
    if (cached && await isValidMatch(cached)) {
      return cached;
    }
  }

  const staticCache = await caches.open(STATIC_CACHE_NAME);
  for (const candidate of candidates) {
    const cached = await staticCache.match(candidate);
    if (cached && await isValidMatch(cached)) {
      return cached;
    }
  }

  // Multi-cache search across other registration caches (e.g. earlier page caches or runtime cache)
  try {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (!cacheName.startsWith(CACHE_PREFIX) || cacheName === PAGE_CACHE_NAME || cacheName === STATIC_CACHE_NAME) {
        continue;
      }
      const cache = await caches.open(cacheName);
      for (const candidate of candidates) {
        const cached = await cache.match(candidate);
        if (cached && await isValidMatch(cached)) {
          // Auto-heal the current PAGE_CACHE_NAME
          try {
            await pageCache.put(candidate, cached.clone());
          } catch {}
          return cached;
        }
      }
    }
  } catch {}

  // Fallback: search across any available cache
  for (const candidate of candidates) {
    try {
      const anyCached = await caches.match(candidate);
      if (anyCached && await isValidMatch(anyCached)) {
        try {
          await pageCache.put(candidate, anyCached.clone());
        } catch {}
        return anyCached;
      }
    } catch {}
  }

  return null;
};

const getOfflineFallbackResponse = async () => {
  try {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    const cachedFallback = await staticCache.match(OFFLINE_FALLBACK_URL);
    if (cachedFallback) {
      return cachedFallback;
    }
  } catch {}

  try {
    const anyFallback = await caches.match("offline-registration.html");
    if (anyFallback) {
      return anyFallback;
    }
  } catch {}

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline Mode</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f1f5f9; color: #1e293b; padding: 20px; box-sizing: border-box; }
    .card { background: #ffffff; border-radius: 16px; padding: 28px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; }
    h2 { margin: 0 0 12px; color: #0d6efd; font-size: 1.3rem; }
    p { margin: 0 0 20px; color: #64748b; font-size: 0.95rem; line-height: 1.5; }
    .btn { display: inline-block; width: 100%; padding: 12px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; text-decoration: none; box-sizing: border-box; }
    .btn-secondary { background: #e2e8f0; color: #334155; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Offline Mode Active</h2>
    <p>Please connect to Wi-Fi or data once to synchronize and ensure all offline pages are downloaded.</p>
    <a href="login.php" class="btn">Go to Login</a>
    <button onclick="window.location.reload()" class="btn btn-secondary">Retry</button>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
};

const handleRegistrationNavigation = async (request) => {
  const pageName = getPageName(request);

  if (pageName === "logout.php") {
    await markLoggedOut();
    if (!navigator.onLine) {
      const cachedLogin = await findCachedRegistrationPage(new Request(buildScopedUrl("login.php"), {
        credentials: "same-origin"
      }));
      if (cachedLogin) return cachedLogin;
      return await getOfflineFallbackResponse();
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch {
      const cachedLogin = await findCachedRegistrationPage(new Request(buildScopedUrl("login.php"), {
        credentials: "same-origin"
      }));
      if (cachedLogin) return cachedLogin;
      return await getOfflineFallbackResponse();
    }
  }

  if (AUTHENTICATED_PAGE_NAMES.has(pageName)) {
    const loggedOut = await isMarkedLoggedOut();
    if (loggedOut) {
      const cachedLogin = await findCachedRegistrationPage(new Request(buildScopedUrl("login.php"), {
        credentials: "same-origin"
      }));
      if (cachedLogin) return cachedLogin;
      return await getOfflineFallbackResponse();
    }
  }

  if (!navigator.onLine) {
    const cachedPage = await findCachedRegistrationPage(request);
    if (cachedPage) {
      return cachedPage;
    }

    if (pageName === "member.php") {
      const cachedMember = await findCachedRegistrationPage(new Request(buildScopedUrl("member.php"), {
        credentials: "same-origin"
      }));
      if (cachedMember) return cachedMember;
    }

    if (pageName === "registration.php") {
      const cachedReg = await findCachedRegistrationPage(new Request(buildScopedUrl("registration.php"), {
        credentials: "same-origin"
      }));
      if (cachedReg) return cachedReg;
    }

    if (pageName === "login.php") {
      const cachedLogin = await findCachedRegistrationPage(new Request(buildScopedUrl("login.php"), {
        credentials: "same-origin"
      }));
      if (cachedLogin) return cachedLogin;
    }

    return await getOfflineFallbackResponse();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.status >= 500) {
      const cachedPage = await findCachedRegistrationPage(request);
      if (cachedPage) return cachedPage;
    }
    await cachePageResponse(request, response.clone());
    return response;
  } catch (error) {
    const cachedPage = await findCachedRegistrationPage(request);
    if (cachedPage) {
      return cachedPage;
    }

    if (pageName === "member.php") {
      const cachedMember = await findCachedRegistrationPage(new Request(buildScopedUrl("member.php"), {
        credentials: "same-origin"
      }));
      if (cachedMember) return cachedMember;
    }

    if (pageName === "registration.php") {
      const cachedReg = await findCachedRegistrationPage(new Request(buildScopedUrl("registration.php"), {
        credentials: "same-origin"
      }));
      if (cachedReg) return cachedReg;
    }

    if (pageName === "login.php") {
      const cachedLogin = await findCachedRegistrationPage(new Request(buildScopedUrl("login.php"), {
        credentials: "same-origin"
      }));
      if (cachedLogin) return cachedLogin;
    }

    return await getOfflineFallbackResponse();
  }
};

const cacheAssetResponse = async (request, response) => {
  if (!response || !response.ok) {
    return;
  }

  const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
  await runtimeCache.put(request, response.clone());

  const normalizedKey = normalizedAssetKey(request);
  if (normalizedKey !== request.url) {
    await runtimeCache.put(normalizedKey, response.clone());
  }
};

const handleAssetRequest = async (request) => {
  if (!navigator.onLine) {
    const cachedExact = await caches.match(request);
    if (cachedExact) {
      return cachedExact;
    }

    const cachedNormalized = await caches.match(normalizedAssetKey(request));
    if (cachedNormalized) {
      return cachedNormalized;
    }

    return Response.error();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    await cacheAssetResponse(request, response.clone());
    return response;
  } catch (error) {
    const cachedExact = await caches.match(request);
    if (cachedExact) {
      return cachedExact;
    }

    const cachedNormalized = await caches.match(normalizedAssetKey(request));
    if (cachedNormalized) {
      return cachedNormalized;
    }

    return Response.error();
  }
};

const cacheCurrentRoute = async (urlString, { preferCached = false } = {}) => {
  let routeUrl = null;
  try {
    routeUrl = getUrl(urlString);
    if (routeUrl.origin !== APP_SCOPE_URL.origin) {
      return { url: routeUrl.toString(), success: false, reason: "cross-origin" };
    }

    if (!routeUrl.pathname.startsWith(APP_SCOPE_PATH) || !REGISTRATION_PAGE_NAMES.has(getPageName(routeUrl))) {
      return { url: routeUrl.toString(), success: false, reason: "unsupported-route" };
    }

    const request = new Request(routeUrl.toString(), {
      cache: "reload",
      credentials: "same-origin"
    });
    if (preferCached || !navigator.onLine) {
      const existingCachedPage = await findCachedRegistrationPage(request);
      if (existingCachedPage) {
        return {
          url: routeUrl.toString(),
          success: true,
          reason: "already-cached"
        };
      }
    }

    if (!navigator.onLine) {
      return {
        url: routeUrl.toString(),
        success: false,
        reason: "offline"
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    const cached = await cachePageResponse(request, response.clone());
    const existingCachedPage = cached === true
      ? null
      : await findCachedRegistrationPage(request);
    const routeReady = cached === true || Boolean(existingCachedPage);
    return {
      url: routeUrl.toString(),
      success: routeReady,
      reason: cached === true
        ? "cached"
        : routeReady
          ? "already-cached"
          : "response-route-mismatch",
      responseUrl: String(response.url || "")
    };
  } catch (error) {
    if (routeUrl) {
      try {
        const request = new Request(routeUrl.toString(), { credentials: "same-origin" });
        const existingCachedPage = await findCachedRegistrationPage(request);
        if (existingCachedPage) {
          return {
            url: routeUrl.toString(),
            success: true,
            reason: "already-cached"
          };
        }
      } catch {
        // Continue with the failed result below.
      }
    }
    return {
      url: String(urlString || ""),
      success: false,
      reason: "fetch-failed"
    };
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    await Promise.allSettled(
      PRECACHE_URLS.map((url) => staticCache.add(new Request(url, { cache: "reload" })))
    );
    await Promise.allSettled(
      REQUIRED_OFFLINE_PAGE_URLS.map((url) => cacheCurrentRoute(url))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const legacyPageCacheNames = cacheNames
      .filter((cacheName) => cacheName.startsWith(`${CACHE_PREFIX}-pages-`))
      .sort()
      .reverse();
    if (legacyPageCacheNames.length > 0) {
      const stablePageCache = await caches.open(PAGE_CACHE_NAME);
      for (const legacyCacheName of legacyPageCacheNames) {
        if (legacyCacheName === PAGE_CACHE_NAME) continue;
        const legacyCache = await caches.open(legacyCacheName);
        const requests = await legacyCache.keys();
        for (const request of requests) {
          const reqPage = getPageName(request);
          const isAuthPage = AUTHENTICATED_PAGE_NAMES.has(reqPage);

          const existingInStable = await stablePageCache.match(request);
          if (existingInStable) {
            if (isAuthPage) {
              const existingHtml = await existingInStable.clone().text();
              if (existingHtml.includes('id="loginForm"') || existingHtml.includes('id="loginBtn"')) {
                await stablePageCache.delete(request);
              } else {
                continue;
              }
            } else {
              continue;
            }
          }

          const response = await legacyCache.match(request);
          if (!response) continue;
          const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
          if (contentType.includes("text/html") && isAuthPage) {
            const html = await response.clone().text();
            if (html.includes('id="loginForm"') || html.includes('id="loginBtn"')) {
              continue;
            }
          }
          await stablePageCache.put(request, response);
        }
      }
    }
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && ![
          STATIC_CACHE_NAME,
          PAGE_CACHE_NAME,
          RUNTIME_CACHE_NAME,
          AUTH_STATE_CACHE_NAME
        ].includes(cacheName))
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isSameOriginGet(request)) {
    return;
  }

  if (isRegistrationPhotoRequest(request)) {
    event.respondWith(handleAssetRequest(request));
    return;
  }

  if (isBypassedRequest(request)) return;

  if (isRegistrationNavigation(request)) {
    event.respondWith(handleRegistrationNavigation(request));
    return;
  }

  if (isAssetRequest(request)) {
    event.respondWith(handleAssetRequest(request));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data && typeof event.data === "object" ? event.data : {};
  if (data.type === "WARM_REGISTRATION_ROUTES") {
    event.waitUntil((async () => {
      const routeUrls = Array.isArray(data.urls)
        ? Array.from(new Set(data.urls.map((url) => String(url || "").trim()).filter(Boolean)))
        : [];
      const results = await Promise.all(routeUrls.map((url) => cacheCurrentRoute(url, {
        preferCached: data.preferCached === true
      })));
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: results.length > 0 && results.every((result) => result.success === true),
          results
        });
      }
    })());
    return;
  }

  if (data.type === "CACHE_CURRENT_ROUTE") {
    event.waitUntil(cacheCurrentRoute(String(data.url || "")));
    return;
  }

  if (data.type === "CLEAR_REGISTRATION_OFFLINE") {
    event.waitUntil(clearRegistrationCaches());
    return;
  }

  if (data.type === "PREPARE_LOGOUT") {
    event.waitUntil((async () => {
      await markLoggedOut();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    })());
    return;
  }

  if (data.type === "OFFLINE_LOGIN_SUCCESS" || data.type === "CLEAR_LOGGED_OUT_STATE") {
    event.waitUntil((async () => {
      await clearLoggedOutState();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    })());
    return;
  }

  if (data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});
