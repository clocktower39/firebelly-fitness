// Exercise-library admin allowlist (EXERCISE_ADMIN_IDS env, comma-separated). Gates who can
// add / edit / merge exercises and their demo media (video links). Single source of truth: enforced
// server-side in exerciseController AND baked into the JWT (services/tokenService.js) so the client
// can gate the edit UI from state.user without a second, drift-prone hardcoded list.
const exerciseAdminIds = (
  process.env.EXERCISE_ADMIN_IDS || "612198502f4d5273b466b4e4,613d0935341e9f055c320d81"
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const isExerciseAdmin = (user) => exerciseAdminIds.includes(String(user?._id || ""));

module.exports = { isExerciseAdmin, exerciseAdminIds };
