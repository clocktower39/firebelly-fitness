const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const Program = require("../models/program");
const Training = require("../models/training");
const Exercise = require("../models/exercise");
const Product = require("../models/product");
const Relationship = require("../models/relationship");
const TrainingBlock = require("../models/trainingBlock");
const { buildProgramWeeks, mesocycleWeeks, validatePublish } = require("../services/programs");
const { createNotification } = require("../services/notificationService");
const { generateProgramFromBlock } = require("../services/programGenerator");
const { recordProgrammingSignal } = require("../services/programmingSignal");

dayjs.extend(utc);

const create_program = async (req, res, next) => {
  try {
    const {
      title = "",
      description = "",
      weeksCount = 4,
      daysPerWeek = 5,
    } = req.body;

    const weeks = buildProgramWeeks(weeksCount, daysPerWeek);

    const program = new Program({
      ownerId: res.locals.user._id,
      title,
      description,
      weeksCount,
      daysPerWeek,
      status: "DRAFT",
      weeks,
    });

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const get_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }
    return res.json(program);
  } catch (err) {
    return next(err);
  }
};

const update_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const {
      title = program.title,
      description = program.description,
      weeksCount = program.weeksCount,
      daysPerWeek = program.daysPerWeek,
      mesocycles,
      price,
    } = req.body;

    program.title = title;
    program.description = description;
    if (price !== undefined) program.price = Number(price) || 0;

    // When mesocycles are provided they drive the total week count (the macrocycle length).
    let nextWeeksCount = Number(weeksCount);
    if (mesocycles !== undefined) {
      program.mesocycles = mesocycles;
      const blockWeeks = mesocycleWeeks(mesocycles);
      if (blockWeeks > 0) nextWeeksCount = blockWeeks;
    }
    const nextDaysPerWeek = Number(daysPerWeek);

    const weeksChanged =
      nextWeeksCount !== Number(program.weeksCount) ||
      nextDaysPerWeek !== Number(program.daysPerWeek);

    program.weeksCount = nextWeeksCount;
    program.daysPerWeek = nextDaysPerWeek;

    if (weeksChanged) {
      program.weeks = buildProgramWeeks(program.weeksCount, program.daysPerWeek, program.weeks);
    }

    const saved = await program.save();
    // Keep the storefront product in sync once a program is published (price/title edits).
    if (saved.status === "PUBLISHED") await syncProgramProduct(saved);
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const update_program_day = async (req, res, next) => {
  try {
    const { weekIndex, dayIndex } = req.params;
    const { workoutId = null, notes = "" } = req.body;

    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });

    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const weekIdx = Number(weekIndex) - 1;
    const dayIdx = Number(dayIndex) - 1;

    if (
      Number.isNaN(weekIdx) ||
      Number.isNaN(dayIdx) ||
      weekIdx < 0 ||
      dayIdx < 0 ||
      weekIdx >= program.weeksCount ||
      dayIdx >= program.daysPerWeek
    ) {
      return res.status(400).json({ error: "Invalid week/day index." });
    }

    if (!program.weeks?.[weekIdx]?.[dayIdx]) {
      program.weeks = buildProgramWeeks(program.weeksCount, program.daysPerWeek, program.weeks);
    }

    program.weeks[weekIdx][dayIdx].workoutId = workoutId || null;
    program.weeks[weekIdx][dayIdx].notes = notes ?? "";

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

// Keep a program in sync with a sellable Product (itemType PROGRAM) on the trainer's products
// page. Best-effort — never throws, so publish/update succeed regardless of product issues.
const syncProgramProduct = async (program) => {
  if (!program?._id || !program.ownerId) return;
  const onInsert = { currency: "USD", taxable: false, deliverableType: "NONE" };
  const fields = {
    trainerId: program.ownerId,
    itemType: "PROGRAM",
    programId: program._id,
    name: (program.title && program.title.trim()) || "Untitled Program",
    description: program.description || "",
    price: Number(program.price) || 0,
    active: program.status === "PUBLISHED",
  };
  try {
    await Product.findOneAndUpdate(
      { programId: program._id },
      { $set: fields, $setOnInsert: onInsert },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      // Name collides with an existing product — disambiguate and retry once.
      try {
        await Product.findOneAndUpdate(
          { programId: program._id },
          { $set: { ...fields, name: `${fields.name} (Program)` }, $setOnInsert: onInsert },
          { upsert: true, new: true }
        );
      } catch (e2) {
        console.error("syncProgramProduct retry failed:", e2.message);
      }
    } else {
      console.error("syncProgramProduct failed:", err.message);
    }
  }
};

const publish_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const errors = validatePublish(program, { requireWorkout: true });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed.", errors });
    }

    program.status = "PUBLISHED";
    program.publishedAt = program.publishedAt || new Date();
    // Snapshot the equipment so the marketplace can show it without per-card scans.
    program.equipmentNeeded = (await computeProgramEquipment(program)).equipment;

    const saved = await program.save();
    await syncProgramProduct(saved); // list it on the trainer's products page for clients
    await recordProgrammingSignal(saved, { finalizedVia: "publish" }); // background signal; internally guarded, never throws
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const list_programs = async (req, res, next) => {
  try {
    const statusFilter = req.query.status;
    const includeShared = req.query.includeShared === "true";
    const userId = res.locals.user._id;

    const query = { ownerId: userId };
    if (statusFilter) {
      query.status = String(statusFilter).toUpperCase();
    }

    const ownPrograms = await Program.find(query)
      .populate({
        path: "ownerId",
        model: "User",
        select: "_id firstName lastName",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const ownWithFlag = ownPrograms.map((p) => ({ ...p, isOwn: true }));

    if (!includeShared) {
      return res.json(ownWithFlag);
    }

    // Get connected trainer IDs with program permissions
    const TrainerConnection = require("../models/trainerConnection");
    const connections = await TrainerConnection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: "accepted",
      permissions: "programs",
    }).lean();

    const connectedTrainerIds = connections.map((c) =>
      c.requester.toString() === userId.toString() ? c.recipient : c.requester
    );

    if (connectedTrainerIds.length === 0) {
      return res.json(ownWithFlag);
    }

    // Get shared programs (only published) from connected trainers
    const sharedQuery = {
      ownerId: { $in: connectedTrainerIds },
      status: "PUBLISHED",
    };

    const sharedPrograms = await Program.find(sharedQuery)
      .populate({
        path: "ownerId",
        model: "User",
        select: "_id firstName lastName",
      })
      .sort({ updatedAt: -1 })
      .lean();

    const sharedWithFlag = sharedPrograms.map((p) => ({ ...p, isOwn: false, isShared: true }));

    return res.json([...ownWithFlag, ...sharedWithFlag]);
  } catch (err) {
    return next(err);
  }
};

const assign_program = async (req, res, next) => {
  try {
    const { clientId, startDate, dayMap } = req.body;
    const trainerId = res.locals.user._id;

    if (!clientId || !startDate) {
      return res.status(400).json({ error: "Client and start date are required." });
    }

    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: trainerId,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const relationship = await Relationship.findOne({
      trainer: trainerId,
      client: clientId,
      accepted: true,
    });
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const baseDate = dayjs(startDate).utc().startOf("day");
    const baseWeekday = baseDate.day();
    const resolvedDayMap = Array.isArray(dayMap) && dayMap.length
      ? dayMap.map((value) => Number(value))
      : null;
    if (resolvedDayMap && resolvedDayMap.length !== program.daysPerWeek) {
      return res.status(400).json({ error: "Day mapping must match days per week." });
    }
    if (resolvedDayMap && resolvedDayMap.some((value) => Number.isNaN(value) || value < 0 || value > 6)) {
      return res.status(400).json({ error: "Day mapping must use weekday values 0-6." });
    }
    const workoutIds = [];
    program.weeks.forEach((week) => {
      week.forEach((day) => {
        if (day.workoutId) workoutIds.push(String(day.workoutId));
      });
    });
    const uniqueWorkoutIds = Array.from(new Set(workoutIds));
    const templates = await Training.find({ _id: { $in: uniqueWorkoutIds } }).lean();
    const templateMap = new Map(templates.map((t) => [String(t._id), t]));

    const newWorkouts = [];
    program.weeks.forEach((week, weekIdx) => {
      week.forEach((day, dayIdx) => {
        if (!day.workoutId) return;
        const template = templateMap.get(String(day.workoutId));
        if (!template) return;
        const targetWeekday = resolvedDayMap ? resolvedDayMap[dayIdx] : baseWeekday + dayIdx;
        const rawOffset = targetWeekday - baseWeekday;
        const dayOffset = rawOffset < 0 ? rawOffset + 7 : rawOffset;
        const date = baseDate.add(weekIdx * 7 + dayOffset, "day").toDate();
        newWorkouts.push({
          title: template.title || `${program.title} • Week ${weekIdx + 1} Day ${dayIdx + 1}`,
          date,
          user: clientId,
          category: template.category || [],
          training: template.training || [],
          workoutFeedback: { difficulty: 1, comments: [] },
          complete: false,
          // Link the assigned copy back to its program so per-client edits (e.g. cascading an
          // exercise swap to future workouts) can reliably scope to this program.
          programId: program._id,
          assignedBy: trainerId,
          assignedAt: new Date(),
        });
      });
    });

    if (!newWorkouts.length) {
      return res.status(400).json({ error: "Program has no workouts to assign." });
    }

    const inserted = await Training.insertMany(newWorkouts);
    createNotification({
      userId: clientId,
      type: "PROGRAM_ASSIGNED",
      title: "New program assigned",
      body: `Your trainer assigned you "${program.title || "a program"}".`,
      link: "/calendar",
    }).catch(() => {});
    await recordProgrammingSignal(program, { finalizedVia: "assign" }); // background signal; internally guarded, never throws
    return res.json({ status: "assigned", count: inserted.length });
  } catch (err) {
    return next(err);
  }
};

// Scan every exercise referenced across a program's workouts and return the distinct
// equipment (sorted) plus the exercise count. Shared by the on-demand endpoint and publish.
const computeProgramEquipment = async (program) => {
  const workoutIds = [];
  (program.weeks || []).forEach((week) => {
    (week || []).forEach((day) => {
      if (day.workoutId) workoutIds.push(day.workoutId);
    });
  });
  if (!workoutIds.length) return { equipment: [], exerciseCount: 0 };

  const workouts = await Training.find({ _id: { $in: workoutIds } }).select("training.exercise").lean();
  const exerciseIds = new Set();
  workouts.forEach((w) => {
    (w.training || []).forEach((circuit) => {
      (circuit || []).forEach((e) => {
        if (e && e.exercise) exerciseIds.add(String(e.exercise));
      });
    });
  });
  if (!exerciseIds.size) return { equipment: [], exerciseCount: 0 };

  const exercises = await Exercise.find({ _id: { $in: [...exerciseIds] } }).select("equipment").lean();
  const equip = new Set();
  exercises.forEach((ex) => {
    (ex.equipment || []).forEach((eq) => {
      if (eq && String(eq).trim()) equip.add(String(eq).trim());
    });
  });
  return { equipment: [...equip].sort((a, b) => a.localeCompare(b)), exerciseCount: exerciseIds.size };
};

// On-demand equipment for the builder (always accurate). Owner, or anyone if published.
const get_program_equipment = async (req, res, next) => {
  try {
    const program = await Program.findOne({ _id: req.params.id }).lean();
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }
    const isOwner = String(program.ownerId) === String(res.locals.user._id);
    if (!isOwner && program.status !== "PUBLISHED") {
      return res.status(403).json({ error: "Unauthorized access." });
    }
    const result = await computeProgramEquipment(program);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

// Trainer generates a coach-reviewable DRAFT program from a client's Training Block.
const generate_program_from_block = async (req, res, next) => {
  try {
    const result = await generateProgramFromBlock({
      trainingBlockId: req.body.trainingBlockId,
      trainerId: res.locals.user._id,
    });
    return res.send(result);
  } catch (err) {
    return res.status(400).send({ error: err.message || "Program generation failed." });
  }
};

// Owner deletes a program: removes its template workouts, unlinks any Training Block + marketplace product.
const delete_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({ _id: req.params.id, ownerId: res.locals.user._id });
    if (!program) return res.status(404).send({ error: "Program not found" });
    const ids = [];
    (program.weeks || []).forEach((wk) => wk.forEach((d) => d.workoutId && ids.push(d.workoutId)));
    if (ids.length) await Training.deleteMany({ _id: { $in: ids }, isTemplate: true }); // templates only, never assigned client workouts
    await TrainingBlock.updateMany({ program: program._id }, { $set: { program: null } });
    await Product.deleteMany({ programId: program._id });
    await Program.deleteOne({ _id: program._id });
    return res.send({ status: "deleted", _id: program._id });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_program,
  delete_program,
  generate_program_from_block,
  list_programs,
  get_program,
  get_program_equipment,
  update_program,
  update_program_day,
  publish_program,
  assign_program,
};
