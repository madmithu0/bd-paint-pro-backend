const axios = require('axios');
const CircuitBreaker = require('opossum');

const callExternalWallAi = async ({ mediaUrl, mediaType = 'photo', manualSqftFallback = 0 }) => {
  if (!process.env.WALL_AI_API_URL) {
    throw new Error('WALL_AI_API_URL not configured');
  }

  const response = await axios.post(
    process.env.WALL_AI_API_URL,
    { imageUrl: mediaUrl, mediaUrl, mediaType },
    { timeout: 15000 }
  );
  return response.data;
};

const aiBreaker = new CircuitBreaker(callExternalWallAi, {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 20000,
});

aiBreaker.fallback(({ manualSqftFallback = 0 }) => ({
  aiUsed: false,
  fallbackToManual: true,
  detectedSqft: Number(manualSqftFallback) || 0,
  wallProblem: ['None'],
  wallDamageLevel: 'Low',
  confidenceScore: 0,
  message: 'AI Vision service offline. Switched seamlessly to Manual Sqft Calculation.',
}));

const analyzeWallMedia = async ({ mediaUrl, imageUrl, mediaType = 'photo', manualSqftFallback = 0 }) => {
  const targetUrl = mediaUrl || imageUrl;
  const result = await aiBreaker.fire({ mediaUrl: targetUrl, mediaType, manualSqftFallback });

  if (result.confidenceScore !== undefined && result.confidenceScore < 0.80) {
    return {
      ...result,
      mediaType,
      requiresManualCheck: true,
      message: 'AI confidence below 0.80 threshold. Manual verification recommended.',
    };
  }

  return { ...result, mediaType };
};

const analyzeWallPhoto = async ({ imageUrl, manualSqftFallback = 0 }) => {
  return analyzeWallMedia({ mediaUrl: imageUrl, mediaType: 'photo', manualSqftFallback });
};

const extractSlotIntent = ({ text = '', defaultSqft = 0 }) => {
  const cleanText = String(text || '').toLowerCase();
  const sqftMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:sqft|sq\s*ft|square\s*feet|স্কয়ার\s*ফিট|বর্গফুট)/i);
  const coatMatch = cleanText.match(/(\d+)\s*(?:coat|coats|কোট)/i);

  const detectedSqft = sqftMatch ? Number(sqftMatch[1]) : Number(defaultSqft) || 0;
  const detectedCoats = coatMatch ? Math.max(1, Number(coatMatch[1])) : 2;
  const isMistriOnly = /(?:mistri\s*only|labour\s*only|মিস্ত্রি\s*শুধু|শুধু\s*মিস্ত্রি|রং\s*আছে)/i.test(cleanText);

  const serviceKeywords = [
    { keyword: /weather\s*coat|ওয়েদার\s*কোট/i, category: 'Weathercoat' },
    { keyword: /distemper|ডিস্টেম্পার/i, category: 'Distemper' },
    { keyword: /enamel|এনামেল/i, category: 'Enamel' },
    { keyword: /plastic|প্লাস্টিক/i, category: 'Plastic Paint' },
    { keyword: /putty|পুটিং|পুট্টি/i, category: 'Wall Putty' },
    { keyword: /texture|টেক্সচার/i, category: 'Texture Paint' },
  ];

  const matched = serviceKeywords.find((item) => item.keyword.test(cleanText));

  return {
    detectedSqft,
    detectedCoats,
    detectedCategory: matched ? matched.category : 'Interior Paint',
    isMistriOnly,
    rawText: text,
  };
};

module.exports = {
  analyzeWallPhoto,
  analyzeWallMedia,
  extractSlotIntent,
};
