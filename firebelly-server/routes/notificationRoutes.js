const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

router.post("/notifications/list", verifyAccessToken, notificationController.list_notifications);
router.post("/notifications/read", verifyAccessToken, ensureWriteAccess, notificationController.mark_read);

module.exports = router;
