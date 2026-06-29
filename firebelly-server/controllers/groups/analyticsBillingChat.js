const {
  ACTIVE_STATUS,
  ASSIGN_ROLES,
  Conversation,
  Message,
  Group,
  GroupInvite,
  GroupMembership,
  GroupProgramAssignment,
  Program,
  ROLE,
  TRAINER_ROLES,
  Training,
  User,
  buildInviteUrl,
  buildTemplateMap,
  buildWorkoutsForUser,
  crypto,
  dayjs,
  ensureRole,
  escapeRegex,
  groupPictureBucket,
  isValidObjectId,
  mongoose,
  normalizeRole,
  requireMembership,
  resolveDayMap,
} = require("./context");

const get_group_analytics = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const match = { groupId: new mongoose.Types.ObjectId(groupId) };
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const parsedStart = dayjs(startDate);
        if (!parsedStart.isValid()) {
          return res.status(400).json({ error: "Invalid start date." });
        }
        dateFilter.$gte = parsedStart.startOf("day").toDate();
      }
      if (endDate) {
        const parsedEnd = dayjs(endDate);
        if (!parsedEnd.isValid()) {
          return res.status(400).json({ error: "Invalid end date." });
        }
        dateFilter.$lte = parsedEnd.endOf("day").toDate();
      }
      match.date = dateFilter;
    }

    const summaryAgg = await Training.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$complete", true] }, 1, 0] },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || { totalAssigned: 0, completed: 0 };
    const completionRate = summary.totalAssigned
      ? summary.completed / summary.totalAssigned
      : 0;

    const byMemberAgg = await Training.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$user",
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$complete", true] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          totalAssigned: 1,
          completed: 1,
        },
      },
      { $sort: { completed: -1 } },
    ]);

    const byMember = byMemberAgg.map((entry) => ({
      ...entry,
      completionRate: entry.totalAssigned ? entry.completed / entry.totalAssigned : 0,
    }));

    return res.json({
      summary: {
        ...summary,
        completionRate,
      },
      byMember,
    });
  } catch (err) {
    return next(err);
  }
};

const update_group_billing = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const { status, planId, trialEndsAt, customerId, subscriptionId } = req.body;
    const allowedStatuses = ["INACTIVE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid billing status." });
    }

    if (status !== undefined) group.billing.status = status;
    if (planId !== undefined) group.billing.planId = planId || null;
    if (customerId !== undefined) group.billing.customerId = customerId || null;
    if (subscriptionId !== undefined) group.billing.subscriptionId = subscriptionId || null;

    if (trialEndsAt !== undefined) {
      if (!trialEndsAt) {
        group.billing.trialEndsAt = null;
      } else {
        const parsed = dayjs(trialEndsAt);
        if (!parsed.isValid()) {
          return res.status(400).json({ error: "Invalid trial end date." });
        }
        group.billing.trialEndsAt = parsed.toDate();
      }
    }

    const saved = await group.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

// Ensure the group's conversation exists (in the unified messaging system) and its participants
// match current active membership, preserving each member's lastReadAt.
const ensureGroupConversation = async (groupId) => {
  const memberships = await GroupMembership.find({ groupId, status: ACTIVE_STATUS })
    .select("userId role")
    .lean();
  const group = await Group.findById(groupId).select("name createdBy").lean();
  const buildParticipants = (existing) =>
    memberships.map((m) => ({
      user: m.userId,
      role: m.role || "member",
      lastReadAt: existing?.get(String(m.userId))?.lastReadAt || null,
    }));
  // Reuse any existing conversation for this group (incl. legacy ones from the old schema) and
  // upgrade it in place — the groupId index is unique.
  let convo = await Conversation.findOne({ groupId });
  if (!convo) {
    convo = await Conversation.create({
      type: "group",
      groupId,
      title: group?.name || "Group",
      participants: buildParticipants(),
      createdBy: group?.createdBy || null,
    });
  } else {
    convo.type = "group";
    if (!convo.title) convo.title = group?.name || "Group";
    const existing = new Map(convo.participants.map((p) => [String(p.user), p]));
    convo.participants = buildParticipants(existing);
    await convo.save();
  }
  return convo;
};

// Old-shape chat payload (messages: [{_id, user, message, timestamp}]) so the existing GroupDetail
// UI keeps working, but backed by the new Message collection.
const formatGroupChat = async (convo) => {
  const messages = await Message.find({ conversation: convo._id, deletedAt: null })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate("sender", "firstName lastName profilePicture")
    .lean();
  return {
    _id: convo._id,
    groupId: convo.groupId,
    messages: messages.map((m) => ({
      _id: m._id,
      user: m.sender,
      message: m.body,
      timestamp: m.createdAt,
    })),
  };
};

const get_group_chat = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;
    if (!isValidObjectId(groupId)) return res.status(400).json({ error: "Invalid group ID." });
    if (!(await requireMembership(groupId, userId))) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    const convo = await ensureGroupConversation(groupId);
    return res.json(await formatGroupChat(convo));
  } catch (err) {
    return next(err);
  }
};

const send_group_message = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;
    const body = String(req.body.message || "").trim();
    if (!isValidObjectId(groupId)) return res.status(400).json({ error: "Invalid group ID." });
    if (!body) return res.status(400).json({ error: "Message is required." });
    if (!(await requireMembership(groupId, userId))) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    const convo = await ensureGroupConversation(groupId);
    const created = await Message.create({ conversation: convo._id, sender: userId, body });
    convo.lastMessageAt = created.createdAt;
    convo.lastMessagePreview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    const me = convo.participants.find((p) => String(p.user) === String(userId));
    if (me) me.lastReadAt = created.createdAt;
    await convo.save();
    // Real-time to the other members (updates their unified inbox live).
    if (global.io) {
      const populated = await Message.findById(created._id)
        .populate("sender", "firstName lastName profilePicture")
        .lean();
      convo.participants
        .filter((p) => String(p.user) !== String(userId))
        .forEach((p) =>
          global.io.to(String(p.user)).emit("message:new", {
            conversationId: String(convo._id),
            message: populated,
          })
        );
    }
    return res.json(await formatGroupChat(convo));
  } catch (err) {
    return next(err);
  }
};

const delete_group_message = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId, messageId } = req.params;
    if (!isValidObjectId(groupId) || !isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid group or message ID." });
    }
    if (!(await requireMembership(groupId, userId))) {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    const convo = await Conversation.findOne({ groupId });
    if (!convo) return res.status(404).json({ error: "Conversation not found." });
    await Message.findOneAndUpdate(
      { _id: messageId, conversation: convo._id, sender: userId, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    return res.json(await formatGroupChat(convo));
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_group_analytics,
  update_group_billing,
  get_group_chat,
  send_group_message,
  delete_group_message
};
