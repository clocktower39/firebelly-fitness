// Config + helpers for the "Yoga" workout type (single-page log; no plan/actual split).

export const YOGA_STYLES = [
  "Vinyasa",
  "Hatha",
  "Ashtanga",
  "Yin",
  "Restorative",
  "Power",
  "Hot / Bikram",
  "Kundalini",
  "Iyengar",
  "Slow Flow",
  "Gentle",
  "Prenatal",
  "Chair",
  "Meditation",
  "Breathwork",
  "Sculpt",
  "Flow",
  "Other",
];

export const YOGA_SESSION_TYPES = [
  "Class",
  "Solo / Home",
  "Guided (app/video)",
  "Private",
  "Workshop",
];

export const YOGA_FOCUS_AREAS = [
  "Hips",
  "Hamstrings",
  "Shoulders",
  "Back",
  "Core",
  "Balance",
  "Chest",
  "Hip flexors",
  "Spine",
  "Full body",
];

export const YOGA_INTENTIONS = [
  "Flexibility",
  "Strength",
  "Relaxation",
  "Breath",
  "Balance",
  "Recovery",
];

export const YOGA_DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
export const YOGA_HEATED_OPTIONS = ["Not heated", "Heated"];
export const YOGA_FEELING_OPTIONS = ["Calm", "Centered", "Energized", "Relaxed", "Sore", "Tired"];
export const YOGA_PROPS = ["Mat", "Blocks", "Strap", "Bolster", "Blanket", "Wheel", "Wall"];

// Standard yoga poses (common English names) for the poses picker. Free-type is still allowed for
// anything not listed.
export const YOGA_POSES = [
  "Boat",
  "Bound Angle (Butterfly)",
  "Bow",
  "Bridge",
  "Camel",
  "Cat",
  "Cat-Cow",
  "Chair",
  "Chaturanga",
  "Child's Pose",
  "Cobra",
  "Corpse (Savasana)",
  "Cow",
  "Cow Face",
  "Crow",
  "Dancer",
  "Dolphin",
  "Downward-Facing Dog",
  "Eagle",
  "Easy Pose",
  "Eight-Angle",
  "Extended Side Angle",
  "Fire Log (Double Pigeon)",
  "Firefly",
  "Fish",
  "Forearm Stand",
  "Forward Fold (Standing)",
  "Four-Limbed Staff",
  "Frog",
  "Garland (Squat)",
  "Gate",
  "Goddess",
  "Half Lord of the Fishes (Seated Twist)",
  "Half Moon",
  "Halfway Lift",
  "Handstand",
  "Happy Baby",
  "Head-to-Knee",
  "Headstand",
  "Hero",
  "High Lunge",
  "Humble Warrior",
  "King Pigeon",
  "Legs Up the Wall",
  "Lizard",
  "Locust",
  "Lotus",
  "Low Lunge",
  "Mountain",
  "Pigeon",
  "Plank",
  "Plow",
  "Puppy (Extended Puppy)",
  "Pyramid",
  "Reclining Bound Angle",
  "Reverse Warrior",
  "Revolved Side Angle",
  "Revolved Triangle",
  "Seated Forward Fold",
  "Shoulder Stand",
  "Side Crow",
  "Side Plank",
  "Sphinx",
  "Staff",
  "Standing Split",
  "Supine Twist",
  "Supported Fish",
  "Table Top",
  "Thread the Needle",
  "Three-Legged Dog",
  "Tree",
  "Triangle",
  "Upward-Facing Dog",
  "Warrior I",
  "Warrior II",
  "Warrior III",
  "Wheel",
  "Wide-Legged Forward Fold",
];

export const YOGA_OPTIONAL_SECTIONS = [
  { key: "focus", label: "Focus" },
  { key: "class", label: "Class details" },
  { key: "mindBody", label: "Mind-body" },
  { key: "props", label: "Props & body" },
  { key: "poses", label: "Poses" },
];

export const DEFAULT_YOGA_POSE = { name: "", hold: "" };

export const DEFAULT_YOGA_FIELDS = {
  style: "Vinyasa",
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
  heated: "",
  temperature: "",
  temperatureUnit: "F",
  // mind-body
  feeling: "",
  meditationMinutes: "",
  // props & body
  props: [],
  avgHeartRate: "",
  calories: "",
  // poses
  poses: [],
  // notes
  notes: "",
};

export const normalizeYoga = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_YOGA_FIELDS,
    ...source,
    focusAreas: Array.isArray(source.focusAreas) ? source.focusAreas : [],
    intentions: Array.isArray(source.intentions) ? source.intentions : [],
    props: Array.isArray(source.props) ? source.props : [],
    poses: Array.isArray(source.poses)
      ? source.poses.map((pose) => ({ ...DEFAULT_YOGA_POSE, ...(pose || {}) }))
      : [],
  };
};

export const buildYogaTitle = (yoga) => {
  if (!yoga) return "";
  const minutes = Number(yoga.durationMinutes);
  const durationPart = minutes > 0 ? `${minutes} min` : "";
  const style = !yoga.style || yoga.style === "Other" ? "Yoga" : yoga.style;
  return [durationPart, style].filter(Boolean).join(" ");
};

const hasValue = (value) => value !== "" && value !== null && value !== undefined;

export const yogaSectionHasData = (yoga) => ({
  focus: (yoga.focusAreas || []).length > 0 || (yoga.intentions || []).length > 0,
  class: [yoga.instructor, yoga.studio, yoga.difficulty, yoga.heated, yoga.temperature].some(hasValue),
  mindBody: [yoga.feeling, yoga.meditationMinutes].some(hasValue),
  props: (yoga.props || []).length > 0 || hasValue(yoga.avgHeartRate) || hasValue(yoga.calories),
  poses: (yoga.poses || []).length > 0,
});
