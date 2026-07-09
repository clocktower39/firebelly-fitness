// Push a drafted program's Week 1 STRUCTURE forward to every later week. Editing Week 1 in the
// builder only touches that one Training doc — added/removed/reordered exercises never reach the
// later weeks, which are independent docs cloned at generation. This rebuilds weeks 2..N of a day
// from the (edited) Week 1 day, re-progressing loads with the SAME engine the generator uses
// (progressWorkout over the program's own mesocycle/deload plan). So whatever Week 1 looks like
// after the trainer's edits becomes the template for every later week: new exercises included,
// removed ones dropped, reordering + circuit grouping carried, each week re-ramped.
//
// It overwrites later weeks IN PLACE (keeps their workoutId, so program refs + the builder cache
// hold). Because it rebuilds later weeks FROM Week 1, a manual tweak made to a later week
// specifically is replaced — that is the intended "apply Week 1 to the rest" behaviour, surfaced
// in the confirm dialog. Only DRAFT programs are eligible (never rewrites an assigned/published
// schedule). Best-effort per day — one bad day can't abort the sweep.

const Program = require("../models/program");
const Training = require("../models/training");
const { expandMesocycles } = require("./programs");
const { sanitizeTrainingTechniques } = require("./techniqueValidation");
const { progressWorkout } = require("./programGenerator");

const deepClone = (o) => (o == null ? undefined : JSON.parse(JSON.stringify(o)));

// Rebuild weeks 2..N of `program` from Week 1. `dayIndexes` (0-based) optionally limits which days
// are synced; omit to sync every day. Returns counts + the ids of the docs that changed.
async function resyncProgramFromWeekOne(program, { dayIndexes = null } = {}) {
  const weeksCount = Number(program.weeksCount) || (program.weeks || []).length || 1;
  const baseSlots = (program.weeks && program.weeks[0]) || [];
  if (!baseSlots.length || weeksCount < 2) {
    return { weeksSynced: 0, daysSynced: 0, updated: 0, created: 0, updatedIds: [] };
  }

  const onlyDays = Array.isArray(dayIndexes) && dayIndexes.length ? new Set(dayIndexes.map(Number)) : null;

  // Load the Week 1 base workouts once.
  const baseIds = baseSlots.map((s) => s && s.workoutId).filter(Boolean);
  const baseDocs = await Training.find({ _id: { $in: baseIds } }).lean();
  const baseById = new Map(baseDocs.map((d) => [String(d._id), d]));

  const plan = expandMesocycles(program.mesocycles || []);
  const ops = [];
  const updatedIds = [];
  let created = 0;
  let daysSynced = 0;
  let weeksSynced = 0;
  let programDirty = false;
  let step = 0;

  for (let w = 1; w < weeksCount; w += 1) {
    const isDeload = Boolean(plan[w] && plan[w].isDeload);
    if (!isDeload) step += 1; // step accrues over non-deload weeks — identical to the generator
    let touchedThisWeek = false;

    for (let d = 0; d < baseSlots.length; d += 1) {
      if (onlyDays && !onlyDays.has(d)) continue;
      const base = baseById.get(String(baseSlots[d] && baseSlots[d].workoutId));
      if (!base) continue; // Week 1 day is empty — nothing to propagate
      const laterSlot = program.weeks[w] && program.weeks[w][d];
      if (!laterSlot) continue;

      try {
        const training = deepClone(base.training) || [[]];
        await progressWorkout(training, { step, deload: isDeload });
        const content = {
          training: sanitizeTrainingTechniques(training),
          category: deepClone(base.category) || [],
          workoutType: base.workoutType,
          cardio: deepClone(base.cardio),
          sports: deepClone(base.sports),
          yoga: deepClone(base.yoga),
          pilates: deepClone(base.pilates),
        };

        if (laterSlot.workoutId) {
          // Overwrite the existing later-week doc in place (keep its _id + title).
          ops.push({ updateOne: { filter: { _id: laterSlot.workoutId }, update: { $set: content } } });
          updatedIds.push(String(laterSlot.workoutId));
        } else {
          // Empty later slot — create a doc and link it so the whole week gets the structure.
          const t = await new Training({
            title: (base.title || `Day ${d + 1}`).replace(/Day (\d+)/, `Week ${w + 1} Day $1`),
            user: base.user,
            isTemplate: true,
            ...content,
          }).save();
          laterSlot.workoutId = t._id;
          updatedIds.push(String(t._id));
          created += 1;
          programDirty = true;
        }
        daysSynced += 1;
        touchedThisWeek = true;
      } catch (err) {
        console.error(`resync week ${w + 1} day ${d + 1} failed (skipped):`, err.message);
      }
    }
    if (touchedThisWeek) weeksSynced += 1;
  }

  if (ops.length) await Training.bulkWrite(ops);
  if (programDirty) await program.save();

  return { weeksSynced, daysSynced, updated: ops.length, created, updatedIds };
}

module.exports = { resyncProgramFromWeekOne };
