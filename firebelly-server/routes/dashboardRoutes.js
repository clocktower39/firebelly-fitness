const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

router.post("/dashboard/attention", verifyAccessToken, dashboardController.get_attention);
router.post("/dashboard/activity", verifyAccessToken, dashboardController.get_activity);
router.post("/dashboard/activity/react", verifyAccessToken, dashboardController.react_to_workout);
router.post("/dashboard/recap", verifyAccessToken, dashboardController.get_recap);
router.post("/dashboard/activity/dismiss", verifyAccessToken, dashboardController.dismiss_activity);

module.exports = router;
