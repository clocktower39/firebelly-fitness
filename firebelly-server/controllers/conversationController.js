const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require("path");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const GuardianLink = require("../models/guardianLink");
const Relationship = require("../models/relationship");
const SavedReply = require("../models/savedReply");
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

// A guardian reads + posts in their child's conversations — ensure they're a participant (role
// "guardian") in each child's direct conversations so the unified inbox + endpoints include them.
const ensureGuardianParticipation = async (guardianId) => {
  const links = await GuardianLink.find({ guardianId }).select("childId").lean();
  if (!links.length) return;
  const childIds = links.map((l) => l.childId);
  const childConvos = await Conversation.find({
    type: "direct",
    "participants.user": { $in: childIds },
  });
  for (const c of childConvos) {
    if (!c.participants.some((p) => String(p.user) === String(guardianId))) {
      c.participants.push({ user: guardianId, role: "guardian" });
      await c.save();
    }
  }
};

// All my conversations, newest activity first, each with an unread count + populated participants.
const get_conversations = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    await ensureGuardianParticipation(meId);
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
    const attachments = (Array.isArray(req.body.attachments) ? req.body.attachments : [])
      .filter((a) => a && a.fileId)
      .map((a) => ({ fileId: a.fileId, type: a.type || "file", name: a.name || "" }));
    if (!body && !attachments.length) {
      return res.status(400).send({ error: "A message body or attachment is required." });
    }

    const convo = await Conversation.findOne({
      _id: req.params.id,
      "participants.user": meId,
    });
    if (!convo) return res.status(403).send({ error: "Not a participant." });

    let message = await Message.create({ conversation: convo._id, sender: meId, body, attachments });
    const preview = body
      ? previewOf(body)
      : attachments[0]?.type === "video"
      ? "🎥 Video"
      : "📷 Photo";
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

// Upload a message attachment to GridFS; the returned fileId is sent back with send_message.
const upload_attachment = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "messageAttachment",
    });
    const filename =
      crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname || "");
    const stream = bucket.openUploadStream(filename, { contentType: req.file.mimetype });
    stream.end(req.file.buffer);
    stream.on("finish", () => {
      const mime = req.file.mimetype || "";
      const type = mime.startsWith("video/")
        ? "video"
        : mime.startsWith("image/")
        ? "image"
        : "file";
      res.status(200).json({ fileId: stream.id, type, name: req.file.originalname || filename });
    });
    stream.on("error", (err) => next(err));
  } catch (err) {
    return next(err);
  }
};

// Stream a message attachment. Served without auth like profile pictures (the fileId is an
// unguessable ObjectId shared only within a conversation); tighten if attachments get sensitive.
const get_attachment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid id." });
    }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "messageAttachment",
    });
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const files = await bucket.find({ _id }).toArray();
    if (!files.length) return res.status(404).json({ error: "Not found." });
    res.set("Content-Type", files[0].contentType || "application/octet-stream");
    bucket
      .openDownloadStream(_id)
      .on("error", () => res.sendStatus(404))
      .pipe(res);
  } catch (err) {
    return next(err);
  }
};

// Trainer broadcast: deliver one message to each selected client's 1:1 conversation.
const broadcast_message = async (req, res, next) => {
  try {
    if (!res.locals.user.isTrainer || res.locals.user.delegationMode) {
      return res.status(403).send({ error: "Only trainers can broadcast." });
    }
    const meId = String(res.locals.user._id);
    const body = String(req.body.body || "").trim();
    const clientIds = Array.isArray(req.body.clientIds) ? req.body.clientIds.map(String) : [];
    if (!body) return res.status(400).send({ error: "A message is required." });
    if (!clientIds.length) return res.status(400).send({ error: "Select at least one recipient." });

    const rels = await Relationship.find({
      trainer: meId,
      client: { $in: clientIds },
      accepted: true,
    })
      .select("client")
      .lean();
    const validIds = rels.map((r) => String(r.client));
    const senderName =
      [res.locals.user.firstName, res.locals.user.lastName].filter(Boolean).join(" ") ||
      "New message";
    const preview = previewOf(body);

    let sent = 0;
    for (const clientId of validIds) {
      const directKey = [meId, clientId].sort().join("_");
      const convo = await Conversation.findOneAndUpdate(
        { directKey },
        {
          $setOnInsert: {
            type: "direct",
            directKey,
            participants: [
              { user: meId, role: "trainer" },
              { user: clientId, role: "client" },
            ],
            createdBy: meId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      let message = await Message.create({ conversation: convo._id, sender: meId, body });
      convo.lastMessageAt = message.createdAt;
      convo.lastMessagePreview = preview;
      const meP = convo.participants.find((p) => String(p.user) === meId);
      if (meP) meP.lastReadAt = message.createdAt;
      await convo.save();
      message = await message.populate("sender", PARTICIPANT_FIELDS);
      if (global.io) {
        global.io
          .to(clientId)
          .emit("message:new", { conversationId: String(convo._id), message });
      }
      await createNotification({
        userId: clientId,
        type: "MESSAGE",
        title: senderName,
        body: preview,
        link: `/messages?c=${convo._id}`,
      });
      sent += 1;
    }
    return res.send({ sent });
  } catch (err) {
    return next(err);
  }
};

// ---- Saved replies (reusable canned responses) ----
const list_saved_replies = async (req, res, next) => {
  try {
    const replies = await SavedReply.find({ user: res.locals.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.send(replies);
  } catch (err) {
    return next(err);
  }
};

const create_saved_reply = async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).send({ error: "Text is required." });
    const reply = await SavedReply.create({ user: res.locals.user._id, text });
    return res.send(reply);
  } catch (err) {
    return next(err);
  }
};

const delete_saved_reply = async (req, res, next) => {
  try {
    await SavedReply.deleteOne({ _id: req.params.id, user: res.locals.user._id });
    return res.send({ status: "success" });
  } catch (err) {
    return next(err);
  }
};

// ---- Search across my messages ----
const search_messages = async (req, res, next) => {
  try {
    const meId = res.locals.user._id;
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.send([]);
    const convos = await Conversation.find({ "participants.user": meId })
      .select("_id type title participants")
      .populate("participants.user", PARTICIPANT_FIELDS)
      .lean();
    const convoMap = new Map(convos.map((c) => [String(c._id), c]));
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const messages = await Message.find({
      conversation: { $in: convos.map((c) => c._id) },
      deletedAt: null,
      body: { $regex: escaped, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .populate("sender", PARTICIPANT_FIELDS)
      .lean();
    return res.send(
      messages.map((m) => ({ ...m, conversation: convoMap.get(String(m.conversation)) }))
    );
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
  upload_attachment,
  get_attachment,
  broadcast_message,
  list_saved_replies,
  create_saved_reply,
  delete_saved_reply,
  search_messages,
};
