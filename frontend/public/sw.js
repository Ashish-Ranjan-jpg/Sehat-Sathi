/* ==========================================================================
   Sehat Saathi PWA Service Worker (sw.js)
   Cache Strategies: Pre-cache App Shell, Network-First for APIs, Offline Support
   ========================================================================== */

const CACHE_NAME = "sehat-saathi-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png",
  "/icons/apple-touch-icon-180x180.png",
  "/icons/favicon-32x32.png",
  "/images/auth-hero.jpg",
  "/images/landing-hero.jpg"
];

// 1. Install Event: Pre-cache static app shell
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installing Sehat Saathi PWA Service Worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Pre-caching App Shell assets");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up legacy caches
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating Sehat Saathi PWA Service Worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for APIs, Cache-first / Stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Handle API Requests (Network-First with Cache Fallback)
  if (url.pathname.startsWith("/api/") || url.port === "8000") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          console.log("[ServiceWorker] Offline fallback for API request:", request.url);
          return caches.match(request);
        })
    );
    return;
  }

  // Stale-While-Revalidate for App Shell & Static Assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Push Notification Handler for Medication Reminders
self.addEventListener("push", (event) => {
  let data = { title: "Sehat Saathi Alert", body: "Medication time reminder!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/favicon-32x32.png",
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: "open", title: "View Schedule" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "open" || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow("/?action=reminders");
      })
    );
  }
});
