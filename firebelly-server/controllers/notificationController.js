const Notification = require("../models/notification");

const list_notifications = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const limit = Math.min(Number(req.body?.limit) || 30, 100);
    const [notifications, unread] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);
    return res.json({ notifications, unread });
  } catch (err) {
    return next(err);
  }
};

const mark_read = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { id, all } = req.body;
    if (all) {
      await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    } else if (id) {
      await Notification.updateOne({ _id: id, userId }, { $set: { read: true } });
    }
    const unread = await Notification.countDocuments({ userId, read: false });
    return res.json({ status: "ok", unread });
  } catch (err) {
    return next(err);
  }
};

module.exports = { list_notifications, mark_read };
