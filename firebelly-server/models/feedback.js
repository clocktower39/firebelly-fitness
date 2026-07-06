const mongoose = require("mongoose");

// App-level user feedback / feature requests. Any user can submit; admins triage via the inbox.
const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["feature", "improvement", "bug", "other"],
      default: "feature",
    },
    title: { type: String, required: true, trim: true },
    idea: { type: String, default: "" }, // what they want + why
    implementation: { type: String, default: "" }, // how they picture it working
    status: {
      type: String,
      enum: ["new", "reviewing", "planned", "in_progress", "done", "declined"],
      default: "new",
    },
    adminNotes: { type: String, default: "" }, // internal, admin-only
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
