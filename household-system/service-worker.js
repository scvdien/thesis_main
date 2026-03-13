const CACHE_PREFIX = "registration-module";
const CACHE_VERSION = "2026-03-13-v2";
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const PAGE_CACHE_NAME = `${CACHE_PREFIX}-pages-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_URL = "./offline-registration.html";
const PRECACHE_URLS = [
  "./registration.php",
  "./member.php",
  OFFLINE_FALLBACK_URL,
  "./manifest.webmanifest",
  "./bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css",
  "./bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js",
  "./assets/vendor/bootstrap-icons/bootstrap-icons.css",
  "./assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2",
  "./assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff",
  "./assets/css/registration-style.css",
  "./assets/js/indexeddb-storage-scripts.js",
  "./assets/js/registration-offline-init.js",
  "./assets/js/registration-scripts.js",
  "./assets/js/member-scripts.js",
  "./assets/img/barangay-cabarian-logo.png"
];
const REGISTRATION_PAGE_NAMES = new Set(["registration.php", "member.php", "offline-registration.html"]);
const BYPASS_PAGE_NAMES = new Set([
  "registration-sync.php",
  "users-api.php",
  "auth-presence.php",
  "login.php",
  "logout.php"
]);
const ASSET_PATH_PATTERN = /\.(?:css|js|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf)$/i;

const getUrl = (input) => new URL(typeof input === "string" ? input : input.url, self.location.origin);
const getPageName = (input) => {
  const url = getUrl(input);
  const segments = url.pathname.split("/");
  return String(segments.pop() || "").trim().toLowerCase();
};

const isSameOriginGet = (request) => request.method === "GET" && getUrl(request).origin === self.location.origin;
const isRegistrationNavigation = (request) => request.mode === "navigate" && REGISTRATION_PAGE_NAMES.has(getPageName(request));
const isBypassedRequest = (request) => BYPASS_PAGE_NAMES.has(getPageName(request));
const isAssetRequest = (request) => ASSET_PATH_PATTERN.test(getUrl(request).pathname);

const normalizedAssetKey = (request) => {
  const url = getUrl(request);
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

const cachePageResponse = async (request, response) => {
  if (!response || !response.ok || !REGISTRATION_PAGE_NAMES.has(getPageName(response.url || request.url))) {
    return;
  }

  const requestUrl = getUrl(request);
  const pageCache = await caches.open(PAGE_CACHE_NAME);
  await pageCache.put(request, response.clone());

  if (requestUrl.search === "") {
    const canonicalUrl = new URL(requestUrl.toString());
    canonicalUrl.hash = "";
    if (canonicalUrl.toString() !== request.url) {
      await pageCache.put(canonicalUrl.toString(), response.clone());
    }
  }
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
  return candidates;
};

const findCachedRegistrationPage = async (request) => {
  const candidates = getRegistrationPageCandidates(request);
  const pageCache = await caches.open(PAGE_CACHE_NAME);
  for (const candidate of candidates) {
    const cached = await pageCache.match(candidate);
    if (cached) {
      return cached;
    }
  }

  const staticCache = await caches.open(STATIC_CACHE_NAME);
  for (const candidate of candidates) {
    const cached = await staticCache.match(candidate);
    if (cached) {
      return cached;
    }
  }

  return null;
};

const handleRegistrationNavigation = async (request) => {
  try {
    const response = await fetch(request);
    await cachePageResponse(request, response.clone());
    return response;
  } catch (error) {
    const cachedPage = await findCachedRegistrationPage(request);
    if (cachedPage) {
      return cachedPage;
    }

    const staticCache = await caches.open(STATIC_CACHE_NAME);
    return (await staticCache.match(OFFLINE_FALLBACK_URL)) || Response.error();
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
  try {
    const response = await fetch(request);
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

const cacheCurrentRoute = async (urlString) => {
  const routeUrl = getUrl(urlString);
  if (routeUrl.origin !== self.location.origin || !REGISTRATION_PAGE_NAMES.has(getPageName(routeUrl))) {
    return;
  }

  try {
    const request = new Request(routeUrl.toString(), {
      cache: "reload",
      credentials: "same-origin"
    });
    const response = await fetch(request);
    await cachePageResponse(request, response.clone());
  } catch (error) {
    // Ignore best-effort route warmup failures.
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    await Promise.allSettled(
      PRECACHE_URLS.map((url) => staticCache.add(new Request(url, { cache: "reload" })))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && ![
          STATIC_CACHE_NAME,
          PAGE_CACHE_NAME,
          RUNTIME_CACHE_NAME
        ].includes(cacheName))
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isSameOriginGet(request) || isBypassedRequest(request)) {
    return;
  }

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
  if (data.type === "CACHE_CURRENT_ROUTE") {
    event.waitUntil(cacheCurrentRoute(String(data.url || "")));
    return;
  }

  if (data.type === "CLEAR_REGISTRATION_OFFLINE") {
    event.waitUntil(clearRegistrationCaches());
    return;
  }

  if (data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});
