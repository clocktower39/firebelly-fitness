// Config + helpers for the "Pilates" workout type (single-page log; no plan/actual split).

export const PILATES_STYLES = [
  "Mat",
  "Reformer",
  "Cadillac / Trapeze",
  "Wunda Chair",
  "Ladder Barrel",
  "Spine Corrector",
  "Tower",
  "Classical",
  "Contemporary",
  "Stott",
  "Clinical / Rehab",
  "Prenatal",
  "Barre Fusion",
  "Power Pilates",
  "Other",
];

export const PILATES_SESSION_TYPES = [
  "Class",
  "Private",
  "Duet",
  "Solo / Home",
  "Guided (app/video)",
  "Workshop",
];

export const PILATES_FOCUS_AREAS = [
  "Core / Powerhouse",
  "Abdominals",
  "Glutes",
  "Back",
  "Hips",
  "Legs",
  "Arms",
  "Shoulders",
  "Pelvic floor",
  "Full body",
  "Balance",
];

export const PILATES_INTENTIONS = [
  "Core strength",
  "Flexibility",
  "Posture",
  "Stability",
  "Mobility",
  "Rehab",
  "Toning",
  "Control",
  "Breath",
];

export const PILATES_DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
export const PILATES_FEELING_OPTIONS = ["Calm", "Centered", "Energized", "Strong", "Lengthened", "Sore", "Tired"];

export const PILATES_EQUIPMENT = [
  "Reformer",
  "Cadillac / Trapeze",
  "Wunda Chair",
  "Ladder Barrel",
  "Spine Corrector",
  "Tower",
  "Mat",
  "Magic Circle",
  "Resistance band",
  "Hand weights",
  "Exercise ball",
  "Foam roller",
  "Ankle straps",
  "Jump board",
];

// Standard Pilates exercises (classical mat + common reformer) for the exercises picker. Free-type is
// still allowed for anything not listed.
export const PILATES_EXERCISES = [
  "Boomerang",
  "Chest Expansion",
  "Control Balance",
  "Corkscrew",
  "Crab",
  "Criss-Cross",
  "Double Leg Kick",
  "Double Leg Stretch",
  "Double Straight Leg Stretch",
  "Down Stretch",
  "Elephant",
  "Eve's Lunge",
  "Footwork",
  "Frog",
  "Hip Circles",
  "Jackknife",
  "Kneeling Side Kicks",
  "Knee Stretch Series",
  "Leg Pull Back",
  "Leg Pull Front",
  "Long Box Series",
  "Long Spine",
  "Long Stretch",
  "Mermaid",
  "Neck Pull",
  "Open Leg Rocker",
  "Pelvic Lift",
  "Plank",
  "Push-Up",
  "Rocking",
  "Rolling Like a Ball",
  "Roll-Over",
  "Roll-Up",
  "Rowing",
  "Running",
  "Saw",
  "Seal",
  "Short Box Series",
  "Short Spine",
  "Shoulder Bridge",
  "Side Bend",
  "Side Kick Series",
  "Single Leg Circles",
  "Single Leg Kick",
  "Single Leg Stretch",
  "Single Straight Leg Stretch",
  "Snake / Twist",
  "Spine Stretch Forward",
  "Spine Twist",
  "Stomach Massage",
  "Swan / Swan Dive",
  "Swimming",
  "Teaser",
  "Tendon Stretch",
  "The Hundred",
  "Thigh Stretch",
  "Up Stretch",
];

export const PILATES_OPTIONAL_SECTIONS = [
  { key: "focus", label: "Focus" },
  { key: "class", label: "Class details" },
  { key: "mindBody", label: "Mind-body" },
  { key: "equipment", label: "Equipment" },
  { key: "exercises", label: "Exercises" },
];

export const DEFAULT_PILATES_EXERCISE = { name: "", reps: "" };

export const DEFAULT_PILATES_FIELDS = {
  style: "Mat",
  sessionType: "Class",
  durationMinutes: "",
  rpe: "",
  // focus
  focusAreas: [],
  intentions: [],
  // class details
  instructor: "",
  studio: "",
  difficulty: "",
  // mind-body
  feeling: "",
  // equipment & body
  equipment: [],
  avgHeartRate: "",
  calories: "",
  // exercises
  exercises: [],
  // notes
  notes: "",
};

export const normalizePilates = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_PILATES_FIELDS,
    ...source,
    focusAreas: Array.isArray(source.focusAreas) ? source.focusAreas : [],
    intentions: Array.isArray(source.intentions) ? source.intentions : [],
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    exercises: Array.isArray(source.exercises)
      ? source.exercises.map((exercise) => ({ ...DEFAULT_PILATES_EXERCISE, ...(exercise || {}) }))
      : [],
  };
};

export const buildPilatesTitle = (pilates) => {
  if (!pilates) return "";
  const minutes = Number(pilates.durationMinutes);
  const durationPart = minutes > 0 ? `${minutes} min` : "";
  const stylePart =
    !pilates.style || pilates.style === "Other" ? "Pilates" : `${pilates.style} Pilates`;
  return [durationPart, stylePart].filter(Boolean).join(" ");
};

const hasValue = (value) => value !== "" && value !== null && value !== undefined;

export const pilatesSectionHasData = (pilates) => ({
  focus: (pilates.focusAreas || []).length > 0 || (pilates.intentions || []).length > 0,
  class: [pilates.instructor, pilates.studio, pilates.difficulty].some(hasValue),
  mindBody: hasValue(pilates.feeling),
  equipment: (pilates.equipment || []).length > 0 || hasValue(pilates.avgHeartRate) || hasValue(pilates.calories),
  exercises: (pilates.exercises || []).length > 0,
});
