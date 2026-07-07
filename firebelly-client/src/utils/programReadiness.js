// Program-readiness summary: how ready a client's inputs are for (future) program generation.
// Pure + display-only in Phase 1; a Phase-2 server generator can reuse these field/assumption defs.

const hasMeasurableTarget = (g) =>
  !!g &&
  Boolean(
    (g.targetWeight && g.targetReps) || g.goalWeight || g.distanceValue || g.goalTime || g.targetReps
  );

// Pick the highest-priority still-active goal.
const topActiveGoal = (goals = []) =>
  [...(goals || [])]
    .filter((g) => g && g.status !== "achieved" && g.status !== "dropped")
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))[0];

export function computeProgramReadiness(user = {}, goals = [], ctx = {}) {
  const tp = user.trainingProfile || {};
  const activeGoals = (goals || []).filter(
    (g) => g && g.status !== "achieved" && g.status !== "dropped"
  );
  const top = topActiveGoal(goals);
  const hasEquipment = Array.isArray(user.equipmentAccess) && user.equipmentAccess.length > 0;

  // Required inputs for programming, each with the default a generator would assume if missing.
  const checks = [
    { label: "Date of birth", ok: !!user.dateOfBirth, assume: "assume age 30" },
    { label: "Height", ok: !!user.height, assume: "assume average height" },
    { label: "Sex", ok: !!user.sex, assume: "assume unspecified" },
    { label: "Body weight", ok: ctx.latestWeight != null, assume: "%-based loads left as targets (no bodyweight ref)" },
    { label: "Training experience", ok: !!user.trainingExperience, assume: "assume intermediate" },
    { label: "Activity level", ok: !!user.activityLevel, assume: "assume moderately active" },
    { label: "Training days/week", ok: !!user.weeklyFrequency, assume: "assume 3 days/week" },
    { label: "Equipment access", ok: hasEquipment, assume: "assume full gym" },
    { label: "At least one goal", ok: activeGoals.length > 0, assume: "no goal — cannot target training" },
    { label: "Top-goal type", ok: !!top?.goalType, assume: "assume general fitness" },
    { label: "Top-goal importance", ok: top?.importanceScore != null, assume: "assume medium importance" },
    { label: "Top-goal measurable target", ok: hasMeasurableTarget(top), assume: "no measurable target — progress can't be tracked" },
    { label: "Top-goal timeline", ok: !!top?.targetDate, assume: "assume 8–12 week timeline" },
  ];

  const missing = checks.filter((c) => !c.ok);
  const missingRequiredFields = missing.map((c) => c.label);
  const assumptions = missing.map((c) => `${c.label}: ${c.assume}`);

  // Profile completeness — the non-goal input fields.
  const profileFilled = [
    !!user.dateOfBirth,
    !!user.height,
    !!user.sex,
    ctx.latestWeight != null,
    !!user.trainingExperience,
    !!user.activityLevel,
    !!user.weeklyFrequency,
    hasEquipment,
    tp.confidenceScore != null,
    tp.willingnessToTrainDaysPerWeek != null,
  ];
  const profileCompletenessScore = Math.round(
    (100 * profileFilled.filter(Boolean).length) / profileFilled.length
  );

  // Goal clarity — how well-specified the top-priority goal is.
  const clarityFilled = top
    ? [!!top.goalType, top.importanceScore != null, hasMeasurableTarget(top), !!top.targetDate, !!top.motivation]
    : [];
  const goalClarityScore = clarityFilled.length
    ? Math.round((100 * clarityFilled.filter(Boolean).length) / clarityFilled.length)
    : 0;

  return { missingRequiredFields, assumptions, profileCompletenessScore, goalClarityScore };
}
