import { apiFetch } from "./client";

export const pushApi = {
  vapidPublicKey: () => apiFetch("/push/vapidPublicKey"),
  subscribe: (subscription, userAgent) =>
    apiFetch("/push/subscribe", { method: "POST", body: { subscription, userAgent } }),
  unsubscribe: (endpoint) =>
    apiFetch("/push/unsubscribe", { method: "POST", body: { endpoint } }),
};
