const { parseVoiceText } = require("../services/speechToText");
const createVoiceBooking = async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, message: "Transcript required" });
    }
    const parsed = parseVoiceText(transcript);
    const jobData = {
      title: `Voice Booking - ${parsed.location || "General"}`,
      location: parsed.location,
      requiredMistri: parsed.mistriCount,
      description: transcript,
      bookingType: "voice",
      status: "pending"
    };
    res.status(200).json({ success: true, parsed, jobData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { createVoiceBooking };