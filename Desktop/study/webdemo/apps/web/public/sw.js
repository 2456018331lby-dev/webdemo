const STATIC_CACHE = "smart-home-static-v1";
const PAGE_CACHE = "smart-home-pages-v1";
const API_CACHE = "smart-home-api-v1";
const OFFLINE_URL = "/offline";

const precacheUrls = [
  "/",
  "/homes",
  "/devices",
  "/activity",
  "/settings",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/apple-touch-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(precacheUrls)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon-maskable.svg",
      tag: payload.tag,
      data: {
        url: payload.url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/activity", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === targetUrl);

      if (existingClient) {
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    const responseClone = response.clone();
    const cache = await caches.open(cacheName);
    cache.put(request, responseClone);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    throw new Error("Network unavailable");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

function readPushPayload(data) {
  const fallback = {
    title: "智能家居提醒",
    body: "有新的设备事件需要关注。",
    tag: "smart-home-alert",
    url: "/activity"
  };

  if (!data) {
    return fallback;
  }

  try {
    return {
      ...fallback,
      ...data.json()
    };
  } catch {
    const text = data.text();
    return {
      ...fallback,
      body: text || fallback.body
    };
  }
}
