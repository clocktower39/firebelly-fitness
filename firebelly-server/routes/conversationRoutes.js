const express = require("express");
const conversationController = require("../controllers/conversationController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.get("/conversations", verifyAccessToken, conversationController.get_conversations);
router.post(
  "/conversations/direct",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.get_or_create_direct
);
router.get(
  "/conversations/:id/messages",
  verifyAccessToken,
  conversationController.get_messages
);
router.post(
  "/conversations/:id/messages",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.send_message
);
router.post("/conversations/:id/read", verifyAccessToken, conversationController.mark_read);
router.post(
  "/messages/:id/delete",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.delete_message
);

module.exports = router;
