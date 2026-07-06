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
router.post(
  "/conversations/broadcast",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.broadcast_message
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
router.post("/conversations/:id/mute", verifyAccessToken, conversationController.mute_conversation);
router.post(
  "/messages/:id/delete",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.delete_message
);
router.get("/messages/search", verifyAccessToken, conversationController.search_messages);

router.get("/saved-replies", verifyAccessToken, conversationController.list_saved_replies);
router.post(
  "/saved-replies",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.create_saved_reply
);
router.post(
  "/saved-replies/:id/delete",
  verifyAccessToken,
  ensureWriteAccess,
  conversationController.delete_saved_reply
);

module.exports = router;
