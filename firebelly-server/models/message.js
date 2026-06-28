const mongoose = require("mongoose");

// One chat message. Stored in its own collection (not embedded) so conversations paginate and
// scale. Phase 1 is text-only; attachments/context (workout/session links) come in later phases.
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Newest-first pagination within a conversation.
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
