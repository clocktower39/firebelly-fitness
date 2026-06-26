const Notification = require("../models/notification");
const { sendPushToUser } = require("./pushService");

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
    // Web push so it reaches the user even when the app is closed (best-effort).
    sendPushToUser(userId, { title, body: body || "", link: link || "" }).catch(() => {});
    return notification;
  } catch (err) {
    return null;
  }
};

module.exports = { createNotification };
