/* Firebelly Fitness service worker — Web Push. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : "Firebelly Fitness" };
  }
  const title = data.title || "Firebelly Fitness";
  const options = {
    body: data.body || "",
    icon: "/logo192.png",
    badge: "/favicon-32.png",
    data: { link: data.link || "/" },
  };
  if (data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && link) client.navigate(link).catch(() => {});
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
      return undefined;
    })
  );
});
