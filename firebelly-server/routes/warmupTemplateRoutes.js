const express = require("express");
const warmupTemplateController = require("../controllers/warmupTemplateController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.get("/warmupTemplates", verifyAccessToken, warmupTemplateController.list_warmup_templates);
router.post("/warmupTemplates", verifyAccessToken, ensureWriteAccess, warmupTemplateController.create_warmup_template);
router.delete("/warmupTemplates/:id", verifyAccessToken, ensureWriteAccess, warmupTemplateController.delete_warmup_template);

module.exports = router;
