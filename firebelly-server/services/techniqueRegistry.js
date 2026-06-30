// Exercise Technique Registry — the single source of truth for the Exercise Technique System.
//
// Techniques are reusable MODIFIERS attached to exercises (see docs/exercise-technique-system-plan.md).
// Definitions are pure, JSON-serializable DATA (no functions) so the exact same registry can be:
//   - validated against on the server (services/techniqueValidation.js),
//   - served to the client over an API and used to auto-generate the config form + display chips,
//   - moved into a DB-backed registry later without changing the attachment shape.
//
// Adding a technique = adding one entry to TECHNIQUES below. No builder/display/schema code changes.
//
// A definition:
//   key           stable id; the storage + analytics + AI key. Never reuse/rename without a migration.
//   name          human label
//   category      one of CATEGORIES[].key
//   scope         "exercise" | "set"   (circuit scope is a future phase — see the plan doc)
//   description   coach- and client-facing explanation (also feeds education popovers later)
//   params[]      typed, declarative field definitions (drive the form, validation, and display)
//   displayFormat template string; "{paramName}" tokens are substituted by the display renderer
//   version       bump when a definition's params change in a breaking way (drives future migrations)
//
// A param:
//   name, label, type, default?, optional?, unit?, min?, max?, maxLength?, options?[{value,label}]
//   type ∈ PARAM_TYPES below.

const PARAM_TYPES = Object.freeze({
  INT: "int", // integer, optional min/max
  NUMBER: "number", // float, optional min/max
  ENUM: "enum", // value must be one of options[].value
  BOOL: "bool", // boolean
  TEMPO: "tempo", // "E-B-C-T" string, digits or "X" (e.g. "3-1-X-0")
  DURATION: "duration", // integer seconds >= 0, optional min/max
  TEXT: "text", // string, optional maxLength
});

// Drawer grouping. `order` controls section order in the UI.
const CATEGORIES = Object.freeze([
  { key: "set", label: "Set Techniques", order: 1 },
  { key: "repScheme", label: "Rep Schemes", order: 2 },
  { key: "tempo", label: "Tempo / Cadence", order: 3 },
  { key: "execution", label: "Execution Styles", order: 4 },
  { key: "intensity", label: "Intensity Methods", order: 5 },
  { key: "density", label: "Density / Time", order: 6 },
]);

const TECHNIQUES = Object.freeze([
  {
    key: "tempo",
    name: "Tempo",
    category: "tempo",
    scope: "exercise",
    description:
      "Prescribe the cadence of each rep as eccentric-bottom-concentric-top seconds. Use X for explosive.",
    params: [
      { name: "tempo", label: "Tempo (E-B-C-T)", type: PARAM_TYPES.TEMPO, default: "3-1-1-0" },
    ],
    displayFormat: "Tempo {tempo}",
    version: 1,
  },
  {
    key: "rir",
    name: "Reps in Reserve",
    category: "intensity",
    scope: "exercise",
    description: "Stop each set with this many reps left in the tank.",
    params: [{ name: "rir", label: "RIR", type: PARAM_TYPES.INT, default: 1, min: 0, max: 5 }],
    displayFormat: "RIR {rir}",
    version: 1,
  },
  {
    key: "toFailure",
    name: "Train to Failure",
    category: "intensity",
    scope: "exercise",
    description: "Take the set to momentary muscular failure.",
    params: [],
    displayFormat: "To failure",
    version: 1,
  },
  {
    key: "dropSet",
    name: "Drop Set",
    category: "set",
    scope: "set",
    description: "At failure, reduce the load and continue for additional reps, repeating per drop.",
    params: [
      { name: "drops", label: "Number of drops", type: PARAM_TYPES.INT, default: 2, min: 1, max: 6 },
      {
        name: "reduction",
        label: "Percent reduction",
        type: PARAM_TYPES.INT,
        default: 20,
        min: 5,
        max: 50,
        unit: "%",
      },
      {
        name: "minWeight",
        label: "Minimum weight",
        type: PARAM_TYPES.NUMBER,
        optional: true,
        min: 0,
        unit: "lb",
      },
    ],
    displayFormat: "Drop set ×{drops} (−{reduction}%)",
    result: {
      itemLabel: "Drop",
      fields: [
        { name: "weight", type: "number", label: "Weight", unit: "lb" },
        { name: "reps", type: "int", label: "Reps" },
      ],
      count: { fromParam: "drops" },
    },
    version: 1,
  },
  {
    key: "restPause",
    name: "Rest-Pause",
    category: "set",
    scope: "set",
    description: "At failure, rest briefly, then perform additional mini-bursts at the same load.",
    params: [
      { name: "bursts", label: "Mini-bursts", type: PARAM_TYPES.INT, default: 2, min: 1, max: 5 },
      {
        name: "restSec",
        label: "Intra-set rest",
        type: PARAM_TYPES.DURATION,
        default: 15,
        min: 5,
        max: 30,
      },
    ],
    displayFormat: "Rest-pause {bursts}× ({restSec}s)",
    result: {
      itemLabel: "Burst",
      fields: [{ name: "reps", type: "int", label: "Reps" }],
      count: { fromParam: "bursts" },
    },
    version: 1,
  },
  {
    key: "clusterSet",
    name: "Cluster Set",
    category: "set",
    scope: "set",
    description: "Break the set into mini-sets separated by short intra-set rest.",
    params: [
      { name: "clusters", label: "Clusters", type: PARAM_TYPES.INT, default: 4, min: 2, max: 8 },
      {
        name: "miniSetReps",
        label: "Reps per cluster",
        type: PARAM_TYPES.INT,
        default: 3,
        min: 1,
        max: 10,
      },
      {
        name: "intraRestSec",
        label: "Intra-set rest",
        type: PARAM_TYPES.DURATION,
        default: 20,
        min: 5,
        max: 60,
      },
    ],
    displayFormat: "Cluster {clusters}×{miniSetReps} ({intraRestSec}s)",
    result: {
      itemLabel: "Cluster",
      fields: [{ name: "reps", type: "int", label: "Reps" }],
      count: { fromParam: "clusters" },
    },
    version: 1,
  },
  {
    key: "amrap",
    name: "AMRAP",
    category: "repScheme",
    scope: "exercise",
    description: "As many reps as possible, optionally within a time cap.",
    params: [
      { name: "timeLimitSec", label: "Time limit", type: PARAM_TYPES.DURATION, optional: true },
      { name: "targetRPE", label: "Target RPE", type: PARAM_TYPES.NUMBER, optional: true, min: 1, max: 10 },
      { name: "failureAllowed", label: "Failure allowed", type: PARAM_TYPES.BOOL, default: true },
    ],
    displayFormat: "AMRAP",
    version: 1,
  },
  {
    key: "repGoal",
    name: "Rep Goal",
    category: "repScheme",
    scope: "exercise",
    description: "Accumulate a target number of reps across as many sub-sets as needed.",
    params: [
      { name: "target", label: "Total reps", type: PARAM_TYPES.INT, default: 50, min: 1, max: 500 },
    ],
    displayFormat: "Rep goal {target}",
    result: {
      itemLabel: "Set",
      fields: [
        { name: "weight", type: "number", label: "Weight", unit: "lb" },
        { name: "reps", type: "int", label: "Reps" },
      ],
      count: { dynamic: true },
      tally: { field: "reps", goalParam: "target" },
    },
    version: 1,
  },
  {
    key: "myoReps",
    name: "Myo-Reps",
    category: "intensity",
    scope: "exercise",
    description: "An activation set near failure followed by short-rest mini-sets.",
    params: [
      {
        name: "activationReps",
        label: "Activation reps",
        type: PARAM_TYPES.INT,
        default: 12,
        min: 5,
        max: 30,
      },
      { name: "miniSets", label: "Mini-sets", type: PARAM_TYPES.INT, default: 4, min: 2, max: 6 },
      { name: "miniReps", label: "Reps per mini-set", type: PARAM_TYPES.INT, default: 3, min: 2, max: 8 },
    ],
    displayFormat: "Myo-reps {activationReps}+{miniSets}×{miniReps}",
    result: {
      itemLabel: "Mini-set",
      fields: [{ name: "reps", type: "int", label: "Reps" }],
      count: { fromParam: "miniSets" },
    },
    version: 1,
  },
  {
    key: "pyramid",
    name: "Pyramid / Ladder",
    category: "repScheme",
    scope: "exercise",
    description:
      "Progress load and reps across sets (e.g. ascending weight with descending reps). Enter each set's targets in the normal per-set fields.",
    params: [
      {
        name: "style",
        label: "Style",
        type: PARAM_TYPES.ENUM,
        default: "pyramid",
        options: [
          { value: "pyramid", label: "Pyramid" },
          { value: "reversePyramid", label: "Reverse pyramid" },
          { value: "ascendingLadder", label: "Ascending ladder" },
          { value: "descendingLadder", label: "Descending ladder" },
        ],
      },
    ],
    displayFormat: "{style}",
    version: 1,
  },
  {
    key: "executionStyle",
    name: "Execution Style",
    category: "execution",
    scope: "exercise",
    description: "Constrain how each rep is executed.",
    params: [
      {
        name: "style",
        label: "Style",
        type: PARAM_TYPES.ENUM,
        default: "eccentricOnly",
        options: [
          { value: "eccentricOnly", label: "Eccentric only" },
          { value: "concentricOnly", label: "Concentric only" },
          { value: "isometric", label: "Isometric" },
          { value: "explosive", label: "Explosive" },
          { value: "continuousTension", label: "Continuous tension" },
          { value: "deadStop", label: "Dead-stop reps" },
          { value: "touchAndGo", label: "Touch-and-go" },
        ],
      },
    ],
    displayFormat: "{style}",
    version: 1,
  },
  {
    key: "restPeriod",
    name: "Rest Period",
    category: "density",
    scope: "exercise",
    description: "Prescribed rest after this exercise before the next.",
    params: [
      { name: "seconds", label: "Rest", type: PARAM_TYPES.DURATION, default: 90, min: 0, max: 600 },
    ],
    displayFormat: "{seconds}s rest",
    version: 1,
  },
]);

const SCOPES = Object.freeze(["exercise", "set"]); // "circuit" is a future phase

const byKey = new Map(TECHNIQUES.map((t) => [t.key, t]));

const getTechnique = (key) => byKey.get(key) || null;
const getAllTechniques = () => TECHNIQUES;
const getCategories = () => CATEGORIES;
const getTechniquesByCategory = (categoryKey) =>
  TECHNIQUES.filter((t) => t.category === categoryKey);

module.exports = {
  PARAM_TYPES,
  CATEGORIES,
  TECHNIQUES,
  SCOPES,
  getTechnique,
  getAllTechniques,
  getCategories,
  getTechniquesByCategory,
};
