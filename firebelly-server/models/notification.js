const mongoose = require("mongoose");

// A lightweight in-app notification for a single recipient (e.g. a trainer being
// told a client requested a booking or a session package).
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "GENERAL" }, // BOOKING_REQUEST | PACKAGE_REQUEST | GENERAL
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" }, // in-app path to open, e.g. "/sessions" or "/invoices"
    read: { type: Boolean, default: false, index: true },
    dismissed: { type: Boolean, default: false }, // cleared from the bell, but kept in history
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, dismissed: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
