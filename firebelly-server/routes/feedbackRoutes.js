const express = require("express");
const feedbackController = require("../controllers/feedbackController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { requireAdmin } = require("../utils/admin");

const router = express.Router();

// Anyone can submit + see their own submissions.
router.post("/feedback", verifyAccessToken, ensureWriteAccess, feedbackController.create_feedback);
router.get("/feedback/mine", verifyAccessToken, feedbackController.list_my_feedback);

// Admin-only inbox + triage.
router.get("/feedback", verifyAccessToken, requireAdmin, feedbackController.list_all_feedback);
router.post(
  "/feedback/:id",
  verifyAccessToken,
  ensureWriteAccess,
  requireAdmin,
  feedbackController.update_feedback
);

module.exports = router;
