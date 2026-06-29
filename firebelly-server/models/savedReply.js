const mongoose = require("mongoose");

// A reusable canned response a user (typically a trainer) can insert into the composer.
const savedReplySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SavedReply", savedReplySchema);
