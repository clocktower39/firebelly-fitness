const mongoose = require("mongoose");

// A participant in a conversation. lastReadAt drives unread counts (messages newer than it are
// unread for that user). role distinguishes trainer/client/guardian/coach/member (used more in
// later phases for groups + guardian attribution).
const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, default: "member" },
    lastReadAt: { type: Date, default: null },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    participants: [participantSchema],
    // Sorted "userIdA_userIdB" for direct conversations, so we can dedupe/upsert race-safely.
    directKey: { type: String, default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    title: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

ConversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });
ConversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ groupId: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.model("Conversation", ConversationSchema);
module.exports = Conversation;
