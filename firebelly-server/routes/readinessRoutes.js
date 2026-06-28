const express = require("express");
const readinessController = require("../controllers/readinessController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post("/readiness", verifyAccessToken, ensureWriteAccess, readinessController.upsert_readiness);
router.get("/readiness", verifyAccessToken, readinessController.get_my_readiness);
router.post("/readiness/client", verifyAccessToken, readinessController.get_client_readiness);
router.get("/readiness/clients", verifyAccessToken, readinessController.get_clients_readiness);

module.exports = router;
