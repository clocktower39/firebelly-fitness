const {
  Exercise,
  Relationship,
  ScheduleEvent,
  TRAINING_UPDATE_FIELDS,
  Training,
  User,
  canWriteUserResource,
  checkClientRelationship,
  createEventDebitEntry,
  dayjs,
  mongoose,
  pick,
  reverseEventDebitEntry,
} = require("./context");

const workout_history_request = async (req, res, next) => {
  const page = parseInt(req.body.page) || 1;
  const limit = 15;
  const user = res.locals.user._id;

  try {
    const options = {
      page,
      limit,
      sort: { date: -1 },
    };

    const result = await Training.paginate({ user }, options);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const workout_month_request = async (req, res, next) => {
  try {
    const { client, date } = req.body;
    const user = res.locals.user;

    const base = dayjs(date).utc();
    const startDate = base.startOf("month").toDate();
    const endDate   = base.startOf("month").add(1, "month").toDate();

    let targetUser = user;

    if (client._id !== user._id) {
      const relationship = await Relationship.findOne({
        trainer: user._id,
        client,
        accepted: true,
      }).populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }

      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      user: targetUser._id,
      date: { $gte: startDate, $lt: endDate },
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const workout_templates_request = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const { includeShared, includeProgramDays } = req.body;

    // Deliberate standalone templates only, by default. Program week/day docs are also
    // isTemplate for storage purposes but belong to their program — they'd flood this
    // list (hundreds of "Program • Week X Day Y" docs), so they only come back when the
    // caller asks (includeProgramDays), labeled with their program's title.
    const ownWorkouts = await Training.find({
      user: user._id,
      isTemplate: true,
      isProgramDay: { $ne: true },
    })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName",
      })
      .lean();

    // Mark own workouts
    let ownWithFlag = ownWorkouts.map((w) => ({ ...w, isOwn: true }));

    if (includeProgramDays) {
      const Program = require("../../models/program");
      const programDays = await Training.find({
        user: user._id,
        isTemplate: true,
        isProgramDay: true,
      })
        .select("title category training updatedAt createdAt programId")
        .populate({
          path: "training.exercise",
          model: "Exercise",
          select: "_id exerciseTitle",
        })
        .lean();
      const programIds = [...new Set(programDays.map((w) => String(w.programId)).filter((id) => id !== "null"))];
      const programs = programIds.length
        ? await Program.find({ _id: { $in: programIds } }).select("title").lean()
        : [];
      const titleById = new Map(programs.map((p) => [String(p._id), p.title || "Untitled program"]));
      ownWithFlag = [
        ...ownWithFlag,
        ...programDays.map((w) => ({
          ...w,
          isOwn: true,
          programDay: true,
          programTitle: titleById.get(String(w.programId)) || "Unlinked draft",
        })),
      ];
    }

    if (!includeShared) {
      return res.json({ workouts: ownWithFlag, user });
    }

    // Get connected trainer IDs with template permissions
    const TrainerConnection = require("../../models/trainerConnection");
    const connections = await TrainerConnection.find({
      $or: [{ requester: user._id }, { recipient: user._id }],
      status: "accepted",
      permissions: "templates",
    }).lean();

    const connectedTrainerIds = connections.map((c) =>
      c.requester.toString() === user._id.toString() ? c.recipient : c.requester
    );

    if (connectedTrainerIds.length === 0) {
      return res.json({ workouts: ownWithFlag, user });
    }

    // Get shared templates from connected trainers (their deliberate templates only —
    // another trainer's program days are never relevant here)
    const sharedWorkouts = await Training.find({
      user: { $in: connectedTrainerIds },
      isTemplate: true,
      isProgramDay: { $ne: true },
    })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName",
      })
      .lean();

    const sharedWithFlag = sharedWorkouts.map((w) => ({ ...w, isOwn: false, isShared: true }));

    return res.json({ workouts: [...ownWithFlag, ...sharedWithFlag], user });
  } catch (err) {
    return next(err);
  }
};

const workout_year_request = async (req, res, next) => {
  try {
    const { client, year } = req.body;
    const user = res.locals.user;

    const base = dayjs(`${year}-01-01`).utc();
    const startDate = base.startOf("year").toDate();
    const endDate = base.startOf("year").add(1, "year").toDate();

    let targetUser = user;

    if (client._id !== user._id) {
      const relationship = await Relationship.findOne({
        trainer: user._id,
        client,
        accepted: true,
      }).populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }

      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      user: targetUser._id,
      date: { $gte: startDate, $lt: endDate },
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  workout_history_request,
  workout_month_request,
  workout_templates_request,
  workout_year_request
};
