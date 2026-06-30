const express = require("express");
const techniqueController = require("../controllers/techniqueController");
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

// Read-only catalog of exercise techniques (definitions + categories).
router.get("/techniques", verifyAccessToken, techniqueController.get_techniques);
router.get("/techniques/usage", verifyAccessToken, techniqueController.get_technique_usage);

module.exports = router;
