// SEMSE Service Worker — Web Push + Offline cache
const CACHE = "semse-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
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
