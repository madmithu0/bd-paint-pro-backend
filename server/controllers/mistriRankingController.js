const Mistri = require("../models/Mistri");
const { calculateMistriScore } = require("../utils/rankingAlgorithm");
const getRankedMistris = async (req, res) => {
  try {
    const mistris = await Mistri.find({ isActive: true }).lean();
    const ranked = mistris.map(m => {
      const scoreData = calculateMistriScore(m);
      return { ...m, ranking: scoreData };
    }).sort((a, b) => b.ranking.totalScore - a.ranking.totalScore);
    res.status(200).json({ success: true, count: ranked.length, data: ranked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { getRankedMistris };