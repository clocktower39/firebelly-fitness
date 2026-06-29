const express = require("express");
const conversationController = require("../controllers/conversationController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { uploadMessageAttachment } = require("../mygridfs");

const router = express.Router();

// Upload an attachment (returns a fileId to include in send_message); served without auth like
// profile pictures so <img>/<video> tags can load it.
router.post(
  "/messages/attachment",
  verifyAccessToken,
  ensureWriteAccess,
  uploadMessageAttachment.single("file"),
  conversationController.upload_attachment
);
router.get("/messages/attachment/:id", conversationController.get_attachment);

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
