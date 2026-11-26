const { runWallInferenceWithFallback } = require('./aiModel');
const { calculateJobPriceAndDays } = require('../../utils/priceUtils');

const inspectWallMediaAndEstimate = async ({
  mediaUrl,
  imageUrl,
  mediaType = 'photo',
  manualSqft = 0,
  isMistriOnly = false,
}) => {
  const targetUrl = mediaUrl || imageUrl;
  const aiOutput = await runWallInferenceWithFallback({
    imageUrl: targetUrl,
    mediaUrl: targetUrl,
    mediaType,
    fallbackSqft: manualSqft,
  });

  const detectedSqft = Number(aiOutput.detectedSqft || manualSqft || 100);
  const confidenceScore = Number(aiOutput.confidenceScore || 0);
  const wallProblem =
    Array.isArray(aiOutput.wallProblem) && aiOutput.wallProblem.length > 0
      ? aiOutput.wallProblem
      : ['None'];
  const wallDamageLevel = aiOutput.wallDamageLevel || 'Low';
  const damageAreaSqft = Number(aiOutput.damageAreaSqft || (wallProblem.includes('None') ? 0 : Math.round(detectedSqft * 0.25)));

  const estimate = calculateJobPriceAndDays({
    sqft: detectedSqft,
    isMistriOnly,
    wallProblem,
    wallDamageLevel,
  });

  const needsManualReview =
    aiOutput.fallbackMode === true || confidenceScore < 0.80;

  return {
    success: true,
    mediaType,
    aiUsed: !aiOutput.fallbackMode,
    confidenceScore,
    needsManualReview,
    reviewReason: needsManualReview
      ? 'AI confidence score is below 0.80 or AI service is in safe fallback mode. Manual verification required.'
      : 'High confidence AI wall frame analysis verified.',
    wallDiagnosis: {
      detectedSqft,
      damageAreaSqft,
      wallProblem,
      wallDamageLevel,
    },
    estimate,
  };
};

const inspectWallPhotoAndEstimate = async ({
  imageUrl,
  manualSqft = 0,
  isMistriOnly = false,
}) => {
  return inspectWallMediaAndEstimate({
    mediaUrl: imageUrl,
    mediaType: 'photo',
    manualSqft,
    isMistriOnly,
  });
};

module.exports = {
  inspectWallPhotoAndEstimate,
  inspectWallMediaAndEstimate,
};
