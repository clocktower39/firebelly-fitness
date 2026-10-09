// The one place that knows what an exercise type MEANS for display.
//
// Four types, and until now each consumer re-derived them from its own switch: the edit and
// log field lists in Exercise.jsx, the prescription summary in WorkoutOverview and again in
// WorkoutReorderEditor, and the goal adornment in LogLoader. That duplication is how Rep Range
// came to render correctly in two places and wrongly in the other two — it showed a blank
// summary on the overview (the switch had no case and fell through to `default: break`), and
// only the bottom of the range in the log field. Both were fixed one site at a time.
//
// These are deliberately pure: no React, no MUI, no formatting of weights (callers own their
// own unit handling). That makes every rule here directly testable.

export const EXERCISE_TYPES = ["Rep Range", "Reps", "Reps with %", "Time"];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const at = (arr, i) => (Array.isArray(arr) ? arr[i] : undefined);

// ---------------------------------------------------------------------------
// Field layouts
// ---------------------------------------------------------------------------

const DESCRIPTORS = {
  "Rep Range": {
    unitNoun: "reps",
    editFields: [
      { goalAttribute: "weight", label: "Weight" },
      { goalAttribute: "minReps", label: "Min Reps" },
      { goalAttribute: "maxReps", label: "Max Reps" },
    ],
    loggedFields: [
      { achievedAttribute: "weight", goalAttribute: "weight", label: "Weight" },
      { achievedAttribute: "reps", goalAttribute: "exactReps", label: "Reps" },
    ],
  },
  Reps: {
    unitNoun: "reps",
    editFields: [
      { goalAttribute: "weight", label: "Weight" },
      { goalAttribute: "exactReps", label: "Reps" },
    ],
    loggedFields: [
      { achievedAttribute: "weight", goalAttribute: "weight", label: "Weight" },
      { achievedAttribute: "reps", goalAttribute: "exactReps", label: "Reps" },
    ],
  },
  "Reps with %": {
    unitNoun: "reps",
    editFields: [
      { goalAttribute: "percent", label: "Percent" },
      { goalAttribute: "exactReps", label: "Reps" },
    ],
    nonRepeatingEditFields: [{ goalAttribute: "maxWeight", label: "One Rep Max" }],
    loggedFields: [
      { achievedAttribute: "weight", goalAttribute: "weight", label: "Weight" },
      { achievedAttribute: "reps", goalAttribute: "exactReps", label: "Reps" },
    ],
  },
  Time: {
    unitNoun: "seconds",
    editFields: [{ goalAttribute: "seconds", label: "Seconds" }],
    loggedFields: [{ achievedAttribute: "seconds", goalAttribute: "seconds", label: "Seconds" }],
  },
};

export const isKnownType = (exerciseType) => Object.hasOwn(DESCRIPTORS, exerciseType);
export const editFieldsFor = (exerciseType) => {
  const d = DESCRIPTORS[exerciseType];
  if (!d) return null;
  return { repeating: d.editFields, nonRepeating: d.nonRepeatingEditFields || [] };
};
export const loggedFieldsFor = (exerciseType) => DESCRIPTORS[exerciseType]?.loggedFields || null;
export const unitNounFor = (exerciseType) => DESCRIPTORS[exerciseType]?.unitNoun || "reps";

// ---------------------------------------------------------------------------
// One set's prescription, as text
// ---------------------------------------------------------------------------

// Rep Range carries a min and a max per set, and double progression walks a working target
// (exactReps) up through that span. All three numbers matter: the floor, the ceiling, and
// what to aim for today.
const repRangeSet = (goals, i) => {
  const lo = num(at(goals.minReps, i));
  const hi = num(at(goals.maxReps, i));
  const target = num(at(goals.exactReps, i));
  if (!hi) return target ? String(target) : lo ? String(lo) : "";
  if (!lo || lo === hi) return String(hi);
  if (target > lo && target <= hi) return `${target} of ${lo}-${hi}`;
  return `${lo}-${hi}`;
};

export const describeSet = (exerciseType, goals = {}, i = 0) => {
  if (exerciseType === "Rep Range") return repRangeSet(goals, i);
  if (exerciseType === "Time") return String(num(at(goals.seconds, i)) || "");
  return String(num(at(goals.exactReps, i)) || "");
};

// How many sets the prescription describes. `goals.sets` is authoritative; the arrays are a
// fallback for legacy entries that never set it.
export const setCountFor = (exerciseType, goals = {}) => {
  const declared = num(goals.sets);
  if (declared > 0) return declared;
  const source =
    exerciseType === "Time" ? goals.seconds
    : exerciseType === "Rep Range" ? goals.minReps
    : exerciseType === "Reps with %" ? goals.percent
    : goals.exactReps;
  return (Array.isArray(source) ? source : []).length;
};

// The summary shown on the overview and in the reorder list: "3 sets: 8-12, 8-12, 8-12 reps".
// `oneRepMax` is returned separately rather than baked into the string, because the callers
// format weights in the viewer's own unit.
export const describePrescription = (exerciseType, goals = {}) => {
  if (!isKnownType(exerciseType)) return null;
  const count = setCountFor(exerciseType, goals);
  const parts = Array.from({ length: count }, (_, i) => describeSet(exerciseType, goals, i)).filter(
    (p) => p !== ""
  );
  const noun = unitNounFor(exerciseType);
  const setLabel = `${count} ${count === 1 ? "set" : "sets"}`;
  return {
    sets: count,
    noun,
    values: parts,
    // 452 live entries prescribe a set count with no target behind it. Listing those as
    // "3 sets: 0, 0, 0 reps" dressed an absent prescription up as a real one, and dropping
    // the numbers alone leaves a gap where they used to be — so say only what is known. With
    // no sets either there is no prescription at all, so say nothing.
    text: count === 0 ? "" : parts.length ? `${setLabel}: ${parts.join(", ")} ${noun}` : setLabel,
    oneRepMax: exerciseType === "Reps with %" ? num(goals.oneRepMax) || null : null,
  };
};

// The same shape for what was actually logged.
export const describeAchieved = (exerciseType, achieved = {}) => {
  const source = exerciseType === "Time" ? achieved.seconds : achieved.reps;
  const values = (Array.isArray(source) ? source : []).map((v) => String(v));
  const meaningful = values.filter((v) => num(v) > 0);
  const noun = unitNounFor(exerciseType);
  return {
    sets: values.length,
    noun,
    values,
    text: meaningful.length
      ? `${values.length} ${values.length === 1 ? "set" : "sets"}: ${values.join(", ")} ${noun}`
      : "",
  };
};

// ---------------------------------------------------------------------------
// The "/x" goal adornment in the logging field
// ---------------------------------------------------------------------------

// `text` is what the client reads; `fillValue` is the single number tapping it inserts. They
// differ for a rep range, where the text is a span but only one number can be filled in.
// `text` of "" means show nothing at all — there is no goal for this field, so the old
// behaviour of offering a tappable "/0" just filled in a zero.
export const goalAdornment = (exerciseType, goals = {}, field = {}, i = 0) => {
  const isRepsField = field.achievedAttribute === "reps";

  if (exerciseType === "Rep Range" && isRepsField) {
    const text = repRangeSet(goals, i);
    const target = num(at(goals.exactReps, i));
    const fillValue = target > 0 ? target : num(at(goals.minReps, i));
    return { text, fillValue, isRange: text.includes("-") };
  }

  if (exerciseType === "Reps with %" && field.achievedAttribute === "weight") {
    const load = (num(goals.oneRepMax) * num(at(goals.percent, i))) / 100;
    return { text: load > 0 ? String(load) : "", fillValue: load, isRange: false };
  }

  const value = num(at(goals[field.goalAttribute], i));
  return { text: value > 0 ? String(value) : "", fillValue: value, isRange: false };
};
