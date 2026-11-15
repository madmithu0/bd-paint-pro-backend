const { runWallInferenceWithFallback } = require('./aiModel');
const { calculateJobPriceAndDays } = require('../../utils/priceUtils');

const inspectWallPhotoAndEstimate = async ({ imageUrl, manualSqft = 0, isMistriOnly = false }) => {
  // 1. Run AI Inference wrapped with Self-Healing Circuit Breaker
  const aiOutput = await runWallInferenceWithFallback({
    imageUrl,
    fallbackSqft: manualSqft,
  });

  const detectedSqft = Number(aiOutput.detectedSqft || manualSqft || 100);
  const confidenceScore = Number(aiOutput.confidenceScore || 0);
  const wallProblem = aiOutput.wallProblem || ['None'];
  const wallDamageLevel = aiOutput.wallDamageLevel || 'Low';

  // 2. Calculate Price & 450 Sqft Days based on AI/Manual findings
  const estimate = calculateJobPriceAndDays({
    sqft: detectedSqft,
    isMistriOnly,
    wallProblem,
    wallDamageLevel,
  });

  // 3. Enforce 0.80 Confidence Score Rule
  const needsManualReview = aiOutput.fallbackMode === true || confidenceScore < 0.80;

  return {
    success: true,
    aiUsed: !aiOutput.fallbackMode,
    confidenceScore,
    needsManualReview,
    reviewReason: needsManualReview
      ? 'AI confidence score is below 0.80 or AI service is in safe fallback mode. Manual verification required.'
      : 'High confidence AI wall analysis verified.',
    wallDiagnosis: {
      detectedSqft,
      wallProblem,
      wallDamageLevel,
    },
    estimate,
  };
};

module.exports = { inspectWallPhotoAndEstimate };
