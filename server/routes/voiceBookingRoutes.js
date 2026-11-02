const express = require("express");
const router = express.Router();
const { createVoiceBooking } = require("../controllers/voiceBookingController");
const { protect } = require("../middleware/auth");
router.post("/create", protect, createVoiceBooking);
module.exports = router;