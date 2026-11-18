const axios = require('axios');
const CircuitBreaker = require('opossum');

const AI_MODEL_VERSION_LOCK = 'WALL-VISION-v3.0.0';

const fetchImageAsBase64 = async (imageUrl) => {
  if (imageUrl.startsWith('data:image/')) {
    const matches = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image format');
    }
    return { mimeType: matches[1], data: matches[2] };
  }

  const imgResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 8000,
  });

  const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
  const data = Buffer.from(imgResponse.data, 'binary').toString('base64');
  return { mimeType, data };
};

const executeModelInference = async ({ imageUrl }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!imageUrl) {
    throw new Error('Image URL is required for AI inference');
  }

  const { mimeType, data } = await fetchImageAsBase64(imageUrl);

  const prompt = `Analyze this wall image for painting and repair estimation in Bangladesh.
Return ONLY a valid raw JSON object with no markdown, no backticks, and no extra text.
Required JSON keys:
- "detectedSqft": number (estimated wall area in square feet, minimum 10)
- "wallProblem": array of strings chosen strictly from ["Nona", "Damp", "Fatol", "None"]
- "wallDamageLevel": string chosen strictly from ["Low", "Medium", "High"]
- "confidenceScore": number between 0.00 and 1.00 indicating confidence that this is a valid wall photo`;

  const endpoint = `https://googleapis.com{apiKey}`;

  const response = await axios.post(
    endpoint,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini Vision API');
  }

  const cleanJson = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  const allowedProblems = ['Nona', 'Damp', 'Fatol', 'None'];
  const validProblems = Array.isArray(parsed.wallProblem)
    ? parsed.wallProblem.filter((p) => allowedProblems.includes(p))
    : ['None'];

  const allowedLevels = ['Low', 'Medium', 'High'];
  const validDamageLevel = allowedLevels.includes(parsed.wallDamageLevel)
    ? parsed.wallDamageLevel
    : 'Low';

  return {
    fallbackMode: false,
    modelVersion: AI_MODEL_VERSION_LOCK,
    detectedSqft: Math.max(10, Number(parsed.detectedSqft) || 100),
    wallProblem: validProblems.length > 0 ? validProblems : ['None'],
    wallDamageLevel: validDamageLevel,
    confidenceScore: Math.min(1, Math.max(0, Number(parsed.confidenceScore) || 0)),
  };
};

const modelCircuitBreaker = new CircuitBreaker(executeModelInference, {
  timeout: 16000,
  errorThresholdPercentage: 50,
  resetTimeout: 15000,
});

modelCircuitBreaker.fallback((params, err) => {
  const safeSqft = Number(params?.fallbackSqft) || 0;
  console.warn(`[AI SELF-HEALING FALLBACK] ${err?.message || 'Service unavailable'}`);
  return {
    fallbackMode: true,
    modelVersion: AI_MODEL_VERSION_LOCK,
    detectedSqft: safeSqft,
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
