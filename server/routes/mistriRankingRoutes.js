const express = require("express");
const router = express.Router();
const { getRankedMistris } = require("../controllers/mistriRankingController");
router.get("/ranked", getRankedMistris);
module.exports = router;