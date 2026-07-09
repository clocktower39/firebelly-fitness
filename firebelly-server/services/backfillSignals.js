// One-time (idempotent) backfill: turn a trainer's EXISTING programs into ProgrammingSignals so the
// deployed personalization (v1 exercise choices + v2 schemes) activates off real history instead of
// waiting for new generate->publish cycles. Pure data op — reuses the capture snapshot/diff helpers.
//
// Hand-built program -> generated:[] (every exercise reads as "added" +2 for v1); a generated draft ->
// its generationSnapshot (a proper diff). Skips programs that already have a signal (never clobbers a
// real captured one) and programs with no week-1 exercises. New programs still auto-capture on publish.

const Program = require("../models/program");
const ProgrammingSignal = require("../models/programmingSignal");
const { snapshotWeekOne, diffSnapshots } = require("./programmingSignal");

async function backfillTrainerSignals(trainerId, { dryRun = false } = {}) {
  const res = { scanned: 0, created: 0, skipped: 0, empty: 0 };
  const programs = await Program.find({ ownerId: trainerId }).lean();
  for (const program of programs) {
    res.scanned += 1;
    try {
      if (await ProgrammingSignal.exists({ programId: program._id })) { res.skipped += 1; continue; }
      const final = await snapshotWeekOne(program);
      const exCount = final.reduce((s, d) => s + ((d.exercises || []).length), 0);
      if (exCount === 0) { res.empty += 1; continue; }
      const generated = Array.isArray(program.generationSnapshot) ? program.generationSnapshot : [];
      const summary = diffSnapshots(generated, final);
      if (!dryRun) {
        await ProgrammingSignal.create({
          trainerId,
          clientId: null,
          programId: program._id,
          trainingBlockId: program.generatedFromBlock || null,
          primaryGoalType: "",
          finalizedVia: "publish",
          generatedAt: program.createdAt || null,
          generated,
          final,
          summary,
        });
      }
      res.created += 1;
    } catch (err) {
      console.error(`backfill program ${program._id} failed (skipped):`, err.message);
      res.skipped += 1;
    }
  }
  return res;
}

async function backfillAllTrainers({ dryRun = false } = {}) {
  const owners = await Program.distinct("ownerId");
  const perTrainer = {};
  const totals = { trainers: owners.length, scanned: 0, created: 0, skipped: 0, empty: 0 };
  for (const ownerId of owners) {
    const r = await backfillTrainerSignals(ownerId, { dryRun });
    perTrainer[String(ownerId)] = r;
    totals.scanned += r.scanned; totals.created += r.created; totals.skipped += r.skipped; totals.empty += r.empty;
  }
  return { totals, perTrainer };
}

module.exports = { backfillTrainerSignals, backfillAllTrainers };
