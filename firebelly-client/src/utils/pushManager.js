import { pushApi } from "../api/pushApi";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const pushSupported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  "Notification" in window;

export const registerServiceWorker = async () => {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    return null;
  }
};

export const getPushPermission = () => (pushSupported() ? Notification.permission : "unsupported");

export const isPushSubscribed = async () => {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch (e) {
    return false;
  }
};

// Request permission, subscribe with the server's VAPID key, and persist the subscription.
export const enablePush = async () => {
  if (!pushSupported()) throw new Error("Push notifications aren't supported in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await pushApi.vapidPublicKey();
    if (!publicKey) throw new Error("Push isn't configured on the server yet.");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await pushApi.subscribe(sub.toJSON ? sub.toJSON() : sub, navigator.userAgent);
  return true;
};

export const disablePush = async () => {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await pushApi.unsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch (e) {
    /* best effort */
  }
};
