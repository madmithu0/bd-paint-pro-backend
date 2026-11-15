const axios = require('axios');
const CircuitBreaker = require('opossum');

const callExternalWallAi = async ({ imageUrl, manualSqftFallback = 0 }) => {
  if (!process.env.WALL_AI_API_URL) {
    throw new Error('WALL_AI_API_URL not configured');
  }

  const response = await axios.post(
    process.env.WALL_AI_API_URL,
    { imageUrl },
    { timeout: 12000 }
  );
  return response.data;
};

const aiBreaker = new CircuitBreaker(callExternalWallAi, {
  timeout: 12000,
  errorThresholdPercentage: 50,
  resetTimeout: 20000,
});

// Auto Fallback to Manual Calculation if AI Service is Down
aiBreaker.fallback(({ manualSqftFallback = 0 }) => ({
  aiUsed: false,
  fallbackToManual: true,
  detectedSqft: Number(manualSqftFallback) || 0,
  wallProblem: ['None'],
  wallDamageLevel: 'Low',
  confidenceScore: 0,
  message: 'AI Vision service offline. Switched seamlessly to Manual Sqft Calculation.',
}));

const analyzeWallPhoto = async ({ imageUrl, manualSqftFallback = 0 }) => {
  const result = await aiBreaker.fire({ imageUrl, manualSqftFallback });

  // Confidence Score < 0.80 triggers Manual Check (File 182)
  if (result.confidenceScore !== undefined && result.confidenceScore < 0.80) {
    return {
      ...result,
      requiresManualCheck: true,
      message: 'AI confidence below 0.80 threshold. Manual verification recommended.',
    };
  }

  return result;
};

module.exports = { analyzeWallPhoto };
