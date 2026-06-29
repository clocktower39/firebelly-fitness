const mongoose = require("mongoose");

// Optional context linking a message back to another entity (e.g. a workout comment surfaced into
// the chat). type = "workout", id = the entity id, label = display name, link = client deep link.
const messageContextSchema = new mongoose.Schema(
  {
    type: { type: String },
    id: { type: mongoose.Schema.Types.ObjectId },
    label: { type: String },
    link: { type: String },
  },
  { _id: false }
);

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
    attachments: [
      {
        fileId: { type: mongoose.Schema.Types.ObjectId },
        type: { type: String, default: "file" }, // image | video | file
        name: { type: String, default: "" },
      },
    ],
    context: { type: messageContextSchema, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Newest-first pagination within a conversation.
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
