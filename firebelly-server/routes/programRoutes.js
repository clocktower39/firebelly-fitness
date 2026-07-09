const express = require("express");
const programController = require("../controllers/programController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.post("/programs", verifyAccessToken, ensureWriteAccess, programController.create_program);
router.post("/programs/generateFromBlock", verifyAccessToken, ensureWriteAccess, programController.generate_program_from_block);
router.get("/programs", verifyAccessToken, programController.list_programs);
router.get("/programs/:id", verifyAccessToken, programController.get_program);
router.get("/programs/:id/equipment", verifyAccessToken, programController.get_program_equipment);
router.put("/programs/:id", verifyAccessToken, ensureWriteAccess, programController.update_program);
router.put(
  "/programs/:id/days/:weekIndex/:dayIndex",
  verifyAccessToken,
  ensureWriteAccess,
  programController.update_program_day
);
router.post("/programs/:id/publish", verifyAccessToken, ensureWriteAccess, programController.publish_program);
router.post("/programs/:id/assign", verifyAccessToken, ensureWriteAccess, programController.assign_program);
router.post("/programs/:id/resyncFromWeekOne", verifyAccessToken, ensureWriteAccess, programController.resync_program_from_week_one);
router.delete("/programs/:id", verifyAccessToken, ensureWriteAccess, programController.delete_program);

module.exports = router;
