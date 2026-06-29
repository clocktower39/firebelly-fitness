const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

// Central scope guard for "view-as" (delegated) sessions. Runs globally, decodes the bearer token
// itself (it sits in front of per-route verifyAccessToken), and restricts what a delegated session
// may touch. One place to audit, so the rules can't be missed on a new route.
//
// trainer_client: STRICT allow-list — a trainer viewing a client may only act on TRAINING data.
//   Everything else (account/security, billing, invoices, products, messaging, push, notifications,
//   relationship/connection admin, entitlements, guardian) is denied by default.
// guardian_child: a guardian legitimately manages their minor's account, so it's a narrow deny-list
//   (no financial surfaces / trainer admin) with everything else allowed.

const TRAINER_CLIENT_ALLOW = [
  // session + read-only profile of the viewed client
  /^\/checkAuthToken$/,
  /^\/getUser$/,
  /^\/trainers$/,
  /^\/user\/profilePicture\//,
  // workouts & training
  /^\/training$/, /^\/workouts$/, /^\/nextWorkout$/, /^\/createTraining$/, /^\/updateTraining$/,
  /^\/trainingWeek$/, /^\/exerciseHistory$/, /^\/exerciseProgressSummary$/, /^\/myExerciseList$/,
  /^\/copyWorkoutById$/, /^\/updateWorkoutDateById$/, /^\/workoutsRange$/, /^\/trainingRangeEnd$/,
  /^\/bulkMoveCopyWorkouts$/, /^\/undoBulkMoveCopy$/, /^\/deleteWorkoutById$/, /^\/getWorkoutHistory$/,
  /^\/workoutMonth$/, /^\/workoutYear$/, /^\/workoutTemplates$/, /^\/getWorkoutQueue$/,
  // programs
  /^\/programs(\/|$)/,
  // goals
  /^\/goals(\/|$)/, /^\/clientGoals$/, /^\/createGoal$/, /^\/removeGoal$/, /^\/updateGoal$/,
  /^\/commentGoal$/, /^\/removeGoalComment$/,
  // metrics
  /^\/metrics\//,
  // readiness
  /^\/readiness(\/|$)/,
  // exercise library (global catalog)
  /^\/exerciseLibrary$/, /^\/exerciseAliases$/, /^\/setExerciseAlias$/, /^\/exerciseFavorites$/,
  /^\/toggleExerciseFavorite$/, /^\/search_exercise$/, /^\/createExercise$/, /^\/updateExercise$/,
  /^\/mergeExercises$/,
  // schedule (manage the client's sessions) + read session summary/types
  /^\/schedule(\/|$)/, /^\/sessions\/summary$/, /^\/session-types$/, /^\/session-types\/purchasable$/,
  /^\/calendar\/feed\/token$/,
];

const GUARDIAN_CHILD_DENY = [
  /^\/billing(\/|$)/,
  /^\/invoices(\/|$)/,
  /^\/products(\/|$)/,
  /^\/trainer-connections(\/|$)/,
  /^\/session-types\/entitlements/,
];

const matchesAny = (path, patterns) => patterns.some((re) => re.test(path));

const enforceDelegationScope = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  let claims;
  try {
    claims = jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (err) {
    return next(); // invalid/expired — let the route's verifyAccessToken return 401/403
  }

  const mode = claims.delegationMode;
  if (!mode) return next(); // not a delegated session

  const path = req.path;

  if (mode === "trainer_client" && !matchesAny(path, TRAINER_CLIENT_ALLOW)) {
    return res
      .status(403)
      .json({ error: "This action isn't available while viewing a client account." });
  }

  if (mode === "guardian_child" && matchesAny(path, GUARDIAN_CHILD_DENY)) {
    return res
      .status(403)
      .json({ error: "This action isn't available while managing a child account." });
  }

  return next();
};

module.exports = { enforceDelegationScope, TRAINER_CLIENT_ALLOW, GUARDIAN_CHILD_DENY };
