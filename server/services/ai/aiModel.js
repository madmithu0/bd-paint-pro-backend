const axios = require('axios');
const CircuitBreaker = require('opossum');

const AI_MODEL_VERSION_LOCK = 'WALL-VISION-v3.0.0';

const executeModelInference = async ({ imageUrl }) => {
  if (!process.env.WALL_AI_API_URL) {
    throw new Error('WALL_AI_API_URL is not configured');
  }

  const response = await axios.post(
    process.env.WALL_AI_API_URL,
    {
      modelVersion: AI_MODEL_VERSION_LOCK,
      imageUrl,
    },
    { timeout: 10000 }
  );

  return response.data;
};

// Self-Healing Circuit Breaker for AI Service
const modelCircuitBreaker = new CircuitBreaker(executeModelInference, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
});

// Instant Auto-Fallback to Manual Calculation Mode on Failure
modelCircuitBreaker.fallback(({ fallbackSqft = 0 }) => {
  console.warn('⚠️ [AI SELF-HEALING FALLBACK] AI Model offline. Switching to Manual Calculation Mode.');
  return {
    fallbackMode: true,
    modelVersion: AI_MODEL_VERSION_LOCK,
    detectedSqft: Number(fallbackSqft) || 0,
    wallProblem: ['None'],
    wallDamageLevel: 'Low',
    confidenceScore: 0,
  };
});

const runWallInferenceWithFallback = async ({ imageUrl, fallbackSqft = 0 }) => {
  return modelCircuitBreaker.fire({ imageUrl, fallbackSqft });
};

module.exports = {
  AI_MODEL_VERSION_LOCK,
  runWallInferenceWithFallback,
};
