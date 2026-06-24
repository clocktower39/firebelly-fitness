const Notification = require("../models/notification");

// Create a persisted notification and push it in real time to the recipient's
// socket room (sockets join a room named by their userId on connect). Never throws
// into the caller — notifications are best-effort.
const createNotification = async ({ userId, type, title, body, link }) => {
  if (!userId || !title) return null;
  try {
    const notification = await Notification.create({
      userId,
      type: type || "GENERAL",
      title,
      body: body || "",
      link: link || "",
    });
    try {
      global.io?.to(String(userId)).emit("notification", notification);
    } catch (emitErr) {
      // realtime is optional; the client also polls
    }
    return notification;
  } catch (err) {
    return null;
  }
};

module.exports = { createNotification };
