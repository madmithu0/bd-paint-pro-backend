const express = require("express");
const router = express.Router();
const { analyzeWall } = require("../controllers/wallAnalyzerController");
const { protect } = require("../middleware/auth");
router.post("/analyze", protect, analyzeWall);
module.exports = router;