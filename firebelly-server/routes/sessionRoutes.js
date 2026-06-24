const express = require("express");
const sessionController = require("../controllers/sessionController");
const sessionTypeController = require("../controllers/sessionTypeController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.post("/sessions/summary", verifyAccessToken, sessionController.get_session_summary);
router.get("/session-types", verifyAccessToken, sessionTypeController.list_session_types);
router.post("/session-types", verifyAccessToken, ensureWriteAccess, sessionTypeController.create_session_type);
router.put("/session-types/:id", verifyAccessToken, ensureWriteAccess, sessionTypeController.update_session_type);
router.delete("/session-types/:id", verifyAccessToken, ensureWriteAccess, sessionTypeController.delete_session_type);
router.post("/session-types/:id/archive", verifyAccessToken, ensureWriteAccess, sessionTypeController.archive_session_type);
router.post("/session-types/:id/reprice", verifyAccessToken, ensureWriteAccess, sessionTypeController.reprice_session_type);
router.post("/session-types/purchasable", verifyAccessToken, sessionTypeController.list_purchasable_types);
router.post("/session-types/entitlements", verifyAccessToken, ensureWriteAccess, sessionTypeController.grant_entitlement);
router.post("/session-types/entitlements/revoke", verifyAccessToken, ensureWriteAccess, sessionTypeController.revoke_entitlement);
router.post("/session-types/entitlements/list", verifyAccessToken, sessionTypeController.list_entitlements);

module.exports = router;
