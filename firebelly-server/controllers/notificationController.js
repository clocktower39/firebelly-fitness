const Notification = require("../models/notification");

const list_notifications = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const limit = Math.min(Number(req.body?.limit) || 30, 100);
    const { before, includeDismissed } = req.body || {};
    const query = { userId };
    if (!includeDismissed) query.dismissed = { $ne: true }; // the bell shows only un-cleared ones
    if (before) query.createdAt = { $lt: new Date(before) }; // cursor for "load more"
    // Fetch one extra to know whether another page exists.
    const rows = await Notification.find(query).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;
    const unread = await Notification.countDocuments({ userId, read: false });
    return res.json({ notifications, unread, hasMore });
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

// Clear a notification (or all) from the bell — it stays in history. Dismissing also marks it read so
// it leaves the unread badge.
const dismiss = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { id, all } = req.body;
    if (all) {
      await Notification.updateMany(
        { userId, dismissed: { $ne: true } },
        { $set: { dismissed: true, read: true } }
      );
    } else if (id) {
      await Notification.updateOne({ _id: id, userId }, { $set: { dismissed: true, read: true } });
    }
    const unread = await Notification.countDocuments({ userId, read: false });
    return res.json({ status: "ok", unread });
  } catch (err) {
    return next(err);
  }
};

module.exports = { list_notifications, mark_read, dismiss };
