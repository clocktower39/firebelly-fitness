const PushSubscription = require("../models/pushSubscription");
const { getPublicKey } = require("../services/pushService");

// Public VAPID key the browser needs to create a push subscription.
const get_vapid_public_key = (req, res) => res.json({ publicKey: getPublicKey() });

// Save (or refresh) the current user's push subscription for this device.
const subscribe = async (req, res, next) => {
  try {
    const { subscription, userAgent } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription." });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: res.locals.user._id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: userAgent || "",
        },
      },
      { upsert: true, new: true }
    );
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
};

const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await PushSubscription.deleteOne({ endpoint });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = { get_vapid_public_key, subscribe, unsubscribe };
