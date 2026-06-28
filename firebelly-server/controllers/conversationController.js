const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const { createNotification } = require("../services/notificationService");

const PARTICIPANT_FIELDS = "firstName lastName username profilePicture isTrainer";
const previewOf = (body) => (body.length > 140 ? `${body.slice(0, 140)}…` : body);

// Count a participant's unread messages in a conversation (messages from others, newer than their
// lastReadAt). Used for inbox badges and the "notify only on the first unread" batching rule.
const unreadFor = (conversationId, userId, lastReadAt) =>
  Message.countDocuments({
    conversation: conversationId,
    deletedAt: null,
    sender: { $ne: userId },
    createdAt: { $gt: lastReadAt || new Date(0) },
  });

// All my conversations, newest activity first, each with an unread count + populated participants.
const get_conversations = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const convos = await Conversation.find({ "participants.user": meId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants.user", PARTICIPANT_FIELDS)
      .lean();
    const withMeta = await Promise.all(
      convos.map(async (c) => {
        const me = c.participants.find((p) => String(p.user?._id || p.user) === String(meId));
        const unread = await unreadFor(c._id, meId, me?.lastReadAt);
        return { ...c, unread };
      })
    );
    return res.send(withMeta);
  } catch (err) {
    return next(err);
  }
};

// Find or create the 1:1 conversation between me and another user (race-safe via directKey).
const get_or_create_direct = async (req, res, next) => {
  try {
    const meId = String(res.locals.user._id);
    const otherId = String(req.body.userId || "");
    if (!otherId || otherId === meId) {
      return res.status(400).send({ error: "A valid userId is required." });
    }
    const other = await User.findById(otherId).select("_id isTrainer").lean();
    if (!other) return res.status(404).send({ error: "User not found." });

    const directKey = [meId, otherId].sort().join("_");
    await Conversation.findOneAndUpdate(
      { directKey },
      {
        $setOnInsert: {
          type: "direct",
          directKey,
          participants: [
            { user: meId, role: res.locals.user.isTrainer ? "trainer" : "client" },
            { user: otherId, role: other.isTrainer ? "trainer" : "client" },
          ],
          createdBy: meId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const populated = await Conversation.findOne({ directKey })
      .populate("participants.user", PARTICIPANT_FIELDS)
      .lean();
    return res.send({ ...populated, unread: 0 });
  } catch (err) {
    return next(err);
  }
};

// Paginated messages for a conversation (newest-first window, returned oldest-first for display).
const get_messages = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const convo = await Conversation.findOne({
      _id: req.params.id,
      "participants.user": meId,
    })
      .select("_id")
      .lean();
    if (!convo) return res.status(403).send({ error: "Not a participant." });

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const filter = { conversation: req.params.id, deletedAt: null };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", PARTICIPANT_FIELDS)
      .lean();
    return res.send(messages.reverse());
  } catch (err) {
    return next(err);
  }
};

// Post a message: persist, bump the conversation, emit to participants live, and notify the
// others on their FIRST unread (so a burst of messages is one notification, not many).
const send_message = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).send({ error: "Message body is required." });

    const convo = await Conversation.findOne({
      _id: req.params.id,
      "participants.user": meId,
    });
    if (!convo) return res.status(403).send({ error: "Not a participant." });

    let message = await Message.create({ conversation: convo._id, sender: meId, body });
    const preview = previewOf(body);
    convo.lastMessageAt = message.createdAt;
    convo.lastMessagePreview = preview;
    const meP = convo.participants.find((p) => String(p.user) === String(meId));
    if (meP) meP.lastReadAt = message.createdAt; // you've "read" your own message
    await convo.save();

    message = await message.populate("sender", PARTICIPANT_FIELDS);
    const senderName =
      [res.locals.user.firstName, res.locals.user.lastName].filter(Boolean).join(" ") ||
      "New message";

    const others = convo.participants.filter((p) => String(p.user) !== String(meId));
    await Promise.all(
      others.map(async (p) => {
        const uid = String(p.user);
        if (global.io) {
          global.io.to(uid).emit("message:new", {
            conversationId: String(convo._id),
            message,
          });
        }
        const unread = await unreadFor(convo._id, p.user, p.lastReadAt);
        if (unread === 1) {
          await createNotification({
            userId: p.user,
            type: "MESSAGE",
            title: senderName,
            body: preview,
            link: `/messages?c=${convo._id}`,
          });
        }
      })
    );
    return res.send(message);
  } catch (err) {
    return next(err);
  }
};

// Mark a conversation read up to now (clears my unread).
const mark_read = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const now = new Date();
    const result = await Conversation.updateOne(
      { _id: req.params.id, "participants.user": meId },
      { $set: { "participants.$.lastReadAt": now } }
    );
    if (!result.matchedCount) return res.status(403).send({ error: "Not a participant." });
    return res.send({ status: "success", lastReadAt: now });
  } catch (err) {
    return next(err);
  }
};

// Soft-delete my own message.
const delete_message = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, sender: meId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!msg) return res.status(404).send({ error: "Message not found." });
    if (global.io) {
      const convo = await Conversation.findById(msg.conversation)
        .select("participants.user")
        .lean();
      (convo?.participants || []).forEach((p) =>
        global.io.to(String(p.user)).emit("message:deleted", {
          conversationId: String(msg.conversation),
          messageId: String(msg._id),
        })
      );
    }
    return res.send({ status: "success", messageId: msg._id });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_conversations,
  get_or_create_direct,
  get_messages,
  send_message,
  mark_read,
  delete_message,
};
