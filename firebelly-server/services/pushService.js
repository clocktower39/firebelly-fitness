const webpush = require("web-push");
const PushSubscription = require("../models/pushSubscription");

let configured = false;
const configure = () => {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:support@firebellyfitness.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
};

const getPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

// Send a push to every device a user has subscribed. Best-effort: prunes dead subscriptions
// (404/410) and never throws.
const sendPushToUser = async (userId, payload) => {
  if (!userId || !configure()) return;
  let subs = [];
  try {
    subs = await PushSubscription.find({ userId }).lean();
  } catch (err) {
    return;
  }
  if (!subs.length) return;
  const body = JSON.stringify(payload || {});
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error("push send failed:", err?.statusCode || err?.message);
        }
      }
    })
  );
};

module.exports = { getPublicKey, sendPushToUser };
