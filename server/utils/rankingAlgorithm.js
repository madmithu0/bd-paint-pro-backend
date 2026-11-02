const calculateMistriScore = (mistri) => {
  const completedJobs = mistri.completedJobs || 0;
  const rating = mistri.averageRating || 0;
  const onTimeRate = mistri.onTimePercentage || 0;
  const responseTime = mistri.avgResponseMinutes || 60;
  const jobScore = Math.min(completedJobs * 2, 40);
  const ratingScore = (rating / 5) * 30;
  const punctualityScore = (onTimeRate / 100) * 20;
  const responseScore = Math.max(0, 10 - (responseTime / 60) * 10);
  const totalScore = parseFloat((jobScore + ratingScore + punctualityScore + responseScore).toFixed(2));
  return {
    totalScore,
    breakdown: { jobScore, ratingScore, punctualityScore, responseScore },
    level: totalScore >= 80 ? "Elite" : totalScore >= 60 ? "Pro" : "Rising"
  };
};
module.exports = { calculateMistriScore };