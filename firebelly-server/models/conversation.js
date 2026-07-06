const mongoose = require("mongoose");

// A participant in a conversation. lastReadAt drives unread counts (messages newer than it are
// unread for that user). role distinguishes trainer/client/guardian/coach/member (used more in
// later phases for groups + guardian attribution).
const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, default: "member" },
    lastReadAt: { type: Date, default: null },
    // When true, this participant gets NO new-message notification/push for this conversation
    // (messages still deliver live; they're just not pinged). Per-user, per-conversation.
    muted: { type: Boolean, default: false },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    participants: [participantSchema],
    // Sorted "userIdA_userIdB" for direct conversations, so we can dedupe/upsert race-safely.
    directKey: { type: String },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    title: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

ConversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });
// Uniqueness only among real values — a "sparse" unique index still indexes explicit nulls, which
// would make every groupId:null direct conversation (or directKey:null group) collide after the first.
ConversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: "string" } } }
);
ConversationSchema.index(
  { groupId: 1 },
  { unique: true, partialFilterExpression: { groupId: { $type: "objectId" } } }
);

const Conversation = mongoose.model("Conversation", ConversationSchema);
module.exports = Conversation;
