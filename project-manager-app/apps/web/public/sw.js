// SEMSE Service Worker — Web Push + fallback offline
const CACHE = "semse-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Descarta caches de versiones anteriores del SW.
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
      clients.claim(),
    ]),
  );
});

// Solo fallback offline: nunca sirve contenido cacheado mientras hay red, asi que
// no puede mostrar datos obsoletos. Ninguna respuesta autenticada se almacena —
// lo unico en cache es la pagina estatica /offline.html precargada en el install.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo navegaciones GET del propio origen. Todo lo demas (API, POST, assets,
  // terceros) pasa directo a la red sin que el SW lo toque.
  if (request.method !== "GET" || request.mode !== "navigate") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error())),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SEMSE", body: event.data.text() };
  }

  const title = payload.title ?? "SEMSE Project";
  const options = {
    body: payload.body ?? "",
    icon: "/icon-1024.png",
    badge: "/icon-1024.png",
    tag: payload.type ?? "semse-notification",
    data: payload,
    actions: payload.actions ?? [],
    requireInteraction: payload.requireInteraction ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  let url = "/";

  if (data.jobId) url = `/jobs/${data.jobId}`;
  else if (data.milestoneId) url = `/buildops/milestones`;
  else if (data.proposalId) url = `/admin/governance`;
  else if (data.changeOrderId) url = `/client/change-orders`;
  else if (data.intakeId) url = `/client/jobs`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
