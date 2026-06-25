// First-pass auto-classification for exercise progression. Heuristic by name — a starting
// point the trainer reviews/overrides in the library. See docs/program-progression-roadmap.md.

const TIME_KW = [
  "hold", "plank", "hollow", "superman", "wall sit", "wall-sit", "dead hang", "dead-hang",
  "l-sit", "lsit", "isometric", "static",
];
const DISTANCE_KW = ["carry", "carries", "farmer", "suitcase"];

// Multi-joint movements → larger weight jumps (barbell +5).
const STRONG_COMPOUND = [
  "squat", "deadlift", "dead lift", "bench", "lunge", "pull-up", "pull up", "pullup",
  "chin-up", "chin up", "chinup", "dip", "clean", "snatch", "jerk", "thruster",
  "hip thrust", "rdl", "romanian", "good morning", "step-up", "step up", "leg press",
  "hack squat", "push-up", "push up", "pushup", "muscle-up", "pulldown", "pull-down",
  "pull down", "row",
];
// Single-joint movements → smaller jumps (barbell/EZ-bar +2.5).
const ISOLATION = [
  "curl", "extension", "raise", "fly", "flye", "kickback", "pushdown", "shrug", "crunch",
  "calf", "pec deck", "lateral", "front delt", "rear delt", "pullover", "pull-over",
  "adduction", "abduction", "wrist", "tricep", "bicep", "skullcrusher", "skull crusher",
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Match a keyword only at a word start (so "narrow" doesn't match "row", but "rows" does).
const hasAny = (t, arr) =>
  arr.some((k) => new RegExp("(^|[^a-z])" + esc(k.toLowerCase())).test(t));

function classifyExercise({ exerciseTitle = "" } = {}) {
  const t = String(exerciseTitle).toLowerCase();

  let measurementType = "reps";
  if (hasAny(t, TIME_KW)) measurementType = "time";
  else if (hasAny(t, DISTANCE_KW)) measurementType = "distance";

  let movementComplexity = "";
  if (measurementType === "reps") {
    if (hasAny(t, STRONG_COMPOUND)) movementComplexity = "compound";
    else if (hasAny(t, ISOLATION)) movementComplexity = "isolation";
    else if (t.includes("press")) movementComplexity = "compound";
    // else "" → needs trainer review
  }

  return { movementComplexity, measurementType };
}

module.exports = { classifyExercise };
