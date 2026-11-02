const { calculatePaintRequirement } = require("../services/imageAnalysis");
const analyzeWall = async (req, res) => {
  try {
    const { width, height, doors, windows, imageUrl } = req.body;
    if (!width || !height) {
      return res.status(400).json({ success: false, message: "Width and height required" });
    }
    const result = calculatePaintRequirement({ width, height, doors, windows });
    res.status(200).json({ success: true, data: { ...result, imageUrl: imageUrl || null } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { analyzeWall };