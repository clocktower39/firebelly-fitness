// App-admin allowlist. Admins are identified by user id via the ADMIN_IDS env var (comma-
// separated), mirroring the existing EXERCISE_ADMIN_IDS convention. Used to gate the app-feedback
// inbox and to route new-feedback notifications. `isAdmin` is also baked into the JWT
// (services/tokenService.js) so the client can gate UI from state.user without a second source.
const adminIds = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const isAdmin = (user) => adminIds.includes(String(user?._id || ""));

const getAdminIds = () => [...adminIds];

// Route guard — 403s non-admins. Place after verifyAccessToken (needs res.locals.user).
const requireAdmin = (req, res, next) => {
  if (!isAdmin(res.locals.user)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
};

module.exports = { isAdmin, getAdminIds, requireAdmin };
