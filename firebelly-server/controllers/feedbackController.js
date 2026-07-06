const Feedback = require("../models/feedback");
const { createNotification } = require("../services/notificationService");
const { getAdminIds } = require("../utils/admin");

const TYPES = ["feature", "improvement", "bug", "other"];
const STATUSES = ["new", "reviewing", "planned", "in_progress", "done", "declined"];
const SUBMITTER_FIELDS = "firstName lastName email profilePicture isTrainer";

// Any authenticated user submits feedback; notify the admins (best-effort).
const create_feedback = async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ error: "A title is required." });

    const type = TYPES.includes(req.body.type) ? req.body.type : "feature";
    const feedback = await Feedback.create({
      user: res.locals.user._id,
      type,
      title,
      idea: String(req.body.idea || "").trim(),
      implementation: String(req.body.implementation || "").trim(),
    });

    const submitter =
      [res.locals.user.firstName, res.locals.user.lastName].filter(Boolean).join(" ") || "A user";
    await Promise.all(
      getAdminIds()
        .filter((id) => String(id) !== String(res.locals.user._id))
        .map((id) =>
          createNotification({
            userId: id,
            type: "FEEDBACK",
            title: `New feedback: ${title}`,
            body: `${submitter} · ${type}`,
            link: "/admin/feedback",
          })
        )
    );

    return res.send(feedback);
  } catch (err) {
    return next(err);
  }
};

// The current user's own submissions (so they can see status on the feedback page).
const list_my_feedback = async (req, res, next) => {
  try {
    const items = await Feedback.find({ user: res.locals.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.send(items);
  } catch (err) {
    return next(err);
  }
};

// Admin inbox: all feedback, newest first, with submitter populated.
const list_all_feedback = async (req, res, next) => {
  try {
    const items = await Feedback.find({})
      .sort({ createdAt: -1 })
      .populate("user", SUBMITTER_FIELDS)
      .lean();
    return res.send(items);
  } catch (err) {
    return next(err);
  }
};

// Admin: update a feedback item's status and/or internal notes.
const update_feedback = async (req, res, next) => {
  try {
    const updates = {};
    if (STATUSES.includes(req.body.status)) updates.status = req.body.status;
    if (typeof req.body.adminNotes === "string") updates.adminNotes = req.body.adminNotes;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "Nothing to update." });
    }
    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    )
      .populate("user", SUBMITTER_FIELDS)
      .lean();
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    return res.send(feedback);
  } catch (err) {
    return next(err);
  }
};

module.exports = { create_feedback, list_my_feedback, list_all_feedback, update_feedback };
