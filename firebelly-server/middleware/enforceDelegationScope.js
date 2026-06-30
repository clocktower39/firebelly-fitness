const jwt = require("jsonwebtoken");
const AuditLog = require("../models/auditLog");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Central scope guard for "view-as" (delegated) sessions. Runs globally, decodes the bearer token
// itself (it sits in front of per-route verifyAccessToken). One place to audit, so rules can't be
// missed on a new route.
//
// trainer_client: only TRAINING data, and only at the per-area level the CLIENT granted this trainer
//   (token `scope` claim, set when the view-as token is issued). Anything outside training (account/
//   security, billing, invoices, messaging, push, notifications, relationship/connection admin,
//   entitlements, guardian) is denied. Missing scope defaults to "manage" (backward compatible).
// guardian_child: narrow deny-list (no financial / trainer-admin), everything else allowed.

// Always allowed for a trainer view-as (not client-owned data / needed to render): catalog + profile read.
const ALWAYS_ALLOWED = [
  /^\/checkAuthToken$/, /^\/getUser$/, /^\/trainers$/, /^\/user\/profilePicture\//,
  /^\/exerciseLibrary$/, /^\/exerciseAliases$/, /^\/setExerciseAlias$/, /^\/exerciseFavorites$/,
  /^\/toggleExerciseFavorite$/, /^\/search_exercise$/, /^\/createExercise$/, /^\/updateExercise$/,
  /^\/mergeExercises$/, /^\/techniques(\/.*)?$/,
];

// Client-data areas the client can grant per trainer (none | view | manage).
const AREA_PATTERNS = {
  workouts: [
    /^\/training$/, /^\/workouts$/, /^\/nextWorkout$/, /^\/createTraining$/, /^\/updateTraining$/,
    /^\/trainingWeek$/, /^\/exerciseHistory$/, /^\/exerciseProgressSummary$/, /^\/myExerciseList$/,
    /^\/copyWorkoutById$/, /^\/updateWorkoutDateById$/, /^\/workoutsRange$/, /^\/trainingRangeEnd$/,
    /^\/bulkMoveCopyWorkouts$/, /^\/undoBulkMoveCopy$/, /^\/deleteWorkoutById$/, /^\/getWorkoutHistory$/,
    /^\/workoutMonth$/, /^\/workoutYear$/, /^\/workoutTemplates$/, /^\/getWorkoutQueue$/,
    /^\/programs(\/|$)/,
  ],
  goals: [
    /^\/goals(\/|$)/, /^\/clientGoals$/, /^\/createGoal$/, /^\/removeGoal$/, /^\/updateGoal$/,
    /^\/commentGoal$/, /^\/removeGoalComment$/,
  ],
  measurements: [/^\/metrics\//],
  readiness: [/^\/readiness(\/|$)/],
  schedule: [
    /^\/schedule(\/|$)/, /^\/sessions\/summary$/, /^\/session-types$/, /^\/session-types\/purchasable$/,
    /^\/calendar\/feed\/token$/,
  ],
};

// The actual MUTATION endpoints per area (the routes that carry ensureWriteAccess). Used for the
// "view" level: a request is a write only if it's a mutating method AND hits one of these — so the
// many POST-but-read endpoints (e.g. POST /workouts, POST /metrics/list) stay readable under "view".
const WRITE_PATTERNS = {
  workouts: [
    /^\/createTraining$/, /^\/updateTraining$/, /^\/copyWorkoutById$/, /^\/updateWorkoutDateById$/,
    /^\/bulkMoveCopyWorkouts$/, /^\/undoBulkMoveCopy$/, /^\/deleteWorkoutById$/,
    /^\/programs$/, /^\/programs\/[^/]+$/, /^\/programs\/[^/]+\/(days|publish|assign)/,
  ],
  goals: [
    /^\/createGoal$/, /^\/removeGoal$/, /^\/updateGoal$/, /^\/commentGoal$/, /^\/removeGoalComment$/,
    /^\/goals\/markAchievementSeen$/,
  ],
  measurements: [/^\/metrics\/(create|update|delete|review)$/],
  readiness: [/^\/readiness$/],
  schedule: [
    /^\/schedule\/event\/(create|update|cancel|delete)$/, /^\/schedule\/series\/delete$/,
    /^\/schedule\/book\/(request|trainer|respond)$/,
  ],
};

const GUARDIAN_CHILD_DENY = [
  /^\/billing(\/|$)/,
  /^\/invoices(\/|$)/,
  /^\/products(\/|$)/,
  /^\/trainer-connections(\/|$)/,
  /^\/session-types\/entitlements/,
];

const matchesAny = (path, patterns) => patterns.some((re) => re.test(path));

const areaForPath = (path) => {
  for (const [area, patterns] of Object.entries(AREA_PATTERNS)) {
    if (matchesAny(path, patterns)) return area;
  }
  return null;
};

const logDelegatedWrite = (claims, req, res, path) => {
  if (!MUTATING.has(req.method)) return;
  res.on("finish", () => {
    AuditLog.create({
      actor: claims.actingUserId || claims._id,
      actorRole: claims.actingUserRole || null,
      targetUser: claims.viewedUserId || claims._id,
      method: req.method,
      path,
      status: res.statusCode,
    }).catch(() => {});
  });
};

const enforceDelegationScope = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  let claims;
  try {
    claims = jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (err) {
    return next(); // invalid/expired — route's verifyAccessToken will 401/403
  }

  const mode = claims.delegationMode;
  if (!mode) return next();

  const path = req.path;

  if (mode === "trainer_client") {
    if (!matchesAny(path, ALWAYS_ALLOWED)) {
      const area = areaForPath(path);
      if (!area) {
        return res
          .status(403)
          .json({ error: "This action isn't available while viewing a client account." });
      }
      // Per-area permission the client granted this trainer (missing => "manage").
      const level = (claims.scope && claims.scope[area]) || "manage";
      if (level === "none") {
        return res.status(403).json({ error: "The client hasn't shared this with you." });
      }
      if (level === "view") {
        const isWrite =
          MUTATING.has(req.method) && matchesAny(path, WRITE_PATTERNS[area] || []);
        if (isWrite) {
          return res.status(403).json({ error: "You have view-only access to this." });
        }
      }
    }
    logDelegatedWrite(claims, req, res, path);
    return next();
  }

  if (mode === "guardian_child") {
    if (matchesAny(path, GUARDIAN_CHILD_DENY)) {
      return res
        .status(403)
        .json({ error: "This action isn't available while managing a child account." });
    }
    logDelegatedWrite(claims, req, res, path);
    return next();
  }

  return next();
};

module.exports = { enforceDelegationScope, ALWAYS_ALLOWED, AREA_PATTERNS, GUARDIAN_CHILD_DENY };
