const express = require("express");
const trainingBlockController = require("../controllers/trainingBlockController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.get("/trainingBlocks", verifyAccessToken, trainingBlockController.list_my_training_blocks);
router.post("/trainingBlocks", verifyAccessToken, ensureWriteAccess, trainingBlockController.create_training_block);
router.post("/trainingBlocks/update", verifyAccessToken, ensureWriteAccess, trainingBlockController.update_training_block);

module.exports = router;
