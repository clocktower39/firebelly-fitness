const Conversation = require("../models/conversation");
const Message = require("../models/message");

const SENDER_FIELDS = "firstName lastName username profilePicture isTrainer";

// Surface a workout comment as a context-linked message in the owner↔trainer 1:1 conversation, so
// workout discussion shows up in the unified inbox + search. Best-effort — never throws (the workout
// comment itself and its WORKOUT_COMMENT notification are the source of truth).
const bridgeWorkoutComment = async ({ ownerId, trainerId, senderId, body, context }) => {
  try {
    if (!ownerId || !trainerId || String(ownerId) === String(trainerId)) return;
    const directKey = [String(ownerId), String(trainerId)].sort().join("_");
    const convo = await Conversation.findOneAndUpdate(
      { directKey },
      {
        $setOnInsert: {
          type: "direct",
          directKey,
          participants: [
            { user: ownerId, role: "client" },
            { user: trainerId, role: "trainer" },
          ],
          createdBy: senderId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const message = await Message.create({
      conversation: convo._id,
      sender: senderId,
      body: body || "",
      context,
    });
    convo.lastMessageAt = message.createdAt;
    convo.lastMessagePreview = context?.label ? `re: ${context.label}` : body || "Workout comment";
    const me = convo.participants.find((p) => String(p.user) === String(senderId));
    if (me) me.lastReadAt = message.createdAt;
    await convo.save();
    if (global.io) {
      const populated = await Message.findById(message._id).populate("sender", SENDER_FIELDS).lean();
      convo.participants
        .filter((p) => String(p.user) !== String(senderId))
        .forEach((p) =>
          global.io.to(String(p.user)).emit("message:new", {
            conversationId: String(convo._id),
            message: populated,
          })
        );
    }
  } catch (err) {
    console.error("bridgeWorkoutComment failed:", err.message);
  }
};

module.exports = { bridgeWorkoutComment };
