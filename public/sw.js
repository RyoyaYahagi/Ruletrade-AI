const CACHE_NAME = "ruletrade-static-v1";
const STATIC_ASSETS = ["/", "/offline", "/icon-192.png", "/icon-512.png"];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch: serve from cache or network
// Do NOT cache API responses or private data
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip API routes
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ??
        fetch(request)
          .then((response) => {
            // Cache static assets only
            if (
              response.ok &&
              (request.destination === "document" ||
                request.destination === "image" ||
                request.destination === "style" ||
                request.destination === "script" ||
                request.destination === "font")
            ) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline fallback for document requests
            if (request.destination === "document") {
              return caches.match("/offline");
            }
            return new Response("Offline", {
              status: 503,
              statusText: "Service Unavailable",
            });
          })
      );
    }),
  );
});
