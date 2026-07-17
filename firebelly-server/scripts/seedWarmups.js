// Seed a curated set of common warm-up movements into the exercise library, tagged "Warm-up" so the
// warm-up picker can lead with them (strength exercises stay searchable too). Idempotent: for a title
// that already exists, it just adds the "Warm-up" tag (and fills measurementType if blank) — never
// clobbers existing data; for a new title it creates a verified exercise. Run: node scripts/seedWarmups.js
// [prod]  (default = local firebelly-dev).
const path = require("path");
const ENV = process.argv[2] === "prod" ? "/var/www/firebelly/server/.env" : undefined;
require("dotenv").config(ENV ? { path: ENV } : {});
const mongoose = require("mongoose");
const Exercise = require(path.join(__dirname, "..", "models", "exercise"));

const WARMUP_TAG = "Warm-up";
// title, primary muscles, equipment, measurementType ("time" for duration/holds/cardio, "reps" for dynamic).
const WARMUPS = [
  // Cardio-modality (duration-based)
  ["Treadmill Warm-up", ["Full Body"], ["Treadmill"], "time"],
  ["Stationary Bike Warm-up", ["Quadriceps"], ["Stationary Bike"], "time"],
  ["Rowing Machine Warm-up", ["Back"], ["Rowing Machine"], "time"],
  ["Elliptical Warm-up", ["Full Body"], ["Elliptical"], "time"],
  ["Jump Rope", ["Calves"], ["Jump Rope"], "time"],
  // Dynamic movement (reps-based)
  ["High Knees", ["Quadriceps"], [], "reps"],
  ["Butt Kicks", ["Hamstrings"], [], "reps"],
  ["A-Skips", ["Quadriceps"], [], "reps"],
  ["Jumping Jacks", ["Full Body"], [], "reps"],
  ["Leg Swings (Front-to-Back)", ["Hamstrings"], [], "reps"],
  ["Leg Swings (Side-to-Side)", ["Glutes"], [], "reps"],
  ["Arm Circles", ["Shoulders"], [], "reps"],
  ["Walking Lunges", ["Quadriceps"], [], "reps"],
  ["Reverse Lunge with Twist", ["Glutes"], [], "reps"],
  ["Inchworms", ["Abdominals"], [], "reps"],
  ["World's Greatest Stretch", ["Full Body"], [], "reps"],
  ["Spiderman Lunge", ["Glutes"], [], "reps"],
  ["Hip Circles", ["Glutes"], [], "reps"],
  ["Ankle Circles", ["Calves"], [], "reps"],
  ["Frankenstein Kicks", ["Hamstrings"], [], "reps"],
  ["Cossack Squats", ["Quadriceps"], [], "reps"],
  ["Bodyweight Squats", ["Quadriceps"], [], "reps"],
  ["Glute Bridges", ["Glutes"], [], "reps"],
  ["Dead Bugs", ["Abdominals"], [], "reps"],
  ["Bird Dogs", ["Back"], [], "reps"],
  ["Scapular Push-ups", ["Shoulders"], [], "reps"],
  ["Band Pull-Aparts", ["Shoulders"], ["Resistance Band"], "reps"],
  ["Band Shoulder Dislocates", ["Shoulders"], ["Resistance Band"], "reps"],
  ["Wrist Circles", ["Forearms"], [], "reps"],
  ["Standing Toe Touches", ["Hamstrings"], [], "reps"],
  // Soft-tissue / mobility (duration)
  ["Foam Roll Quads", ["Quadriceps"], ["Foam Roller"], "time"],
  ["Foam Roll Hamstrings", ["Hamstrings"], ["Foam Roller"], "time"],
  ["Foam Roll Glutes", ["Glutes"], ["Foam Roller"], "time"],
  ["Foam Roll Back", ["Back"], ["Foam Roller"], "time"],
  ["Foam Roll Calves", ["Calves"], ["Foam Roller"], "time"],
  ["Foam Roll IT Band", ["Quadriceps"], ["Foam Roller"], "time"],
  ["Foam Roll Lats", ["Back"], ["Foam Roller"], "time"],
  ["Cat-Cow", ["Back"], [], "time"],
  ["Child's Pose", ["Back"], [], "time"],
  ["90/90 Hip Stretch", ["Glutes"], [], "time"],
];

(async () => {
  const DBURL = ENV ? process.env.DBURL : "mongodb://127.0.0.1:27017/firebelly-dev";
  await mongoose.connect(DBURL);
  console.log("DB:", mongoose.connection.name);
  let created = 0;
  let tagged = 0;
  let already = 0;
  for (const [title, primary, equipment, measurementType] of WARMUPS) {
    const existing = await Exercise.findOne({ exerciseTitle: title });
    if (existing) {
      const set = {};
      if (!(existing.tags || []).includes(WARMUP_TAG)) set.tags = [...(existing.tags || []), WARMUP_TAG];
      if (!existing.measurementType) set.measurementType = measurementType;
      if (Object.keys(set).length) {
        await Exercise.updateOne({ _id: existing._id }, { $set: set });
        tagged += 1;
      } else {
        already += 1;
      }
      continue;
    }
    await Exercise.create({
      exerciseTitle: title,
      muscleGroups: { primary, secondary: [] },
      equipment,
      tags: [WARMUP_TAG],
      measurementType,
      movementComplexity: "",
      verified: true,
    });
    created += 1;
  }
  const total = await Exercise.countDocuments({ tags: WARMUP_TAG });
  console.log(`✅ warm-ups: created ${created}, tagged existing ${tagged}, already-ok ${already} | total tagged "${WARMUP_TAG}": ${total}`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
