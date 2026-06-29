const express = require("express");
const pushController = require("../controllers/pushController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.get("/push/vapidPublicKey", pushController.get_vapid_public_key);
router.post("/push/subscribe", verifyAccessToken, ensureWriteAccess, pushController.subscribe);
router.post("/push/unsubscribe", verifyAccessToken, ensureWriteAccess, pushController.unsubscribe);

module.exports = router;
