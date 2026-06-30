const express = require("express");
const techniqueController = require("../controllers/techniqueController");
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

// Read-only catalog of exercise techniques (definitions + categories).
router.get("/techniques", verifyAccessToken, techniqueController.get_techniques);

module.exports = router;
