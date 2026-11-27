const axios = require('axios');

const BANGLA_DIGIT_MAP = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const DIALECT_NORMALIZATION_RULES = [
  { pattern: /(হাজার|হাজর|hajar)/gi, multiplier: 1000 },
  { pattern: /(শো|শ|sho|hundred)/gi, multiplier: 100 },
];

const SERVICE_KEYWORDS = [
  { key: 'Distemper', capacity: 800, terms: ['distemper', 'ডিস্টেম্পার', 'ডিসটেম্পার', 'চুনকাম'] },
  { key: 'Plastic Paint', capacity: 550, terms: ['plastic', 'প্লাস্টিক', 'প্লাসটিক', 'ইমালশন', 'emulsion'] },
  { key: 'Weathercoat', capacity: 500, terms: ['weathercoat', 'weather coat', 'ওয়েদারকোট', 'বাইরের রং', 'বাহিরের রং'] },
  { key: 'Luxury Silk', capacity: 450, terms: ['silk', 'সিল্ক', 'রয়্যাল', 'royal'] },
  { key: 'Enamel Paint', capacity: 400, terms: ['enamel', 'এনামেল', 'গ্রিল', 'দরজা', 'জানালা', 'লোহা'] },
  { key: 'Texture Paint', capacity: 350, terms: ['texture', 'টেক্সচার', 'ডিজাইন রং'] },
  { key: 'Damp Proofing', capacity: 300, terms: ['damp', 'nona', 'fatol', 'ড্যাম্প', 'নোনা', 'ফাটল', 'স্যাঁতসেঁতে', 'লবণ'] },
  { key: 'Putty & Primer', capacity: 600, terms: ['putty', 'primer', 'পুটি', 'প্রাইমার', 'ঘষা'] },
];

const normalizeBanglaNumbers = (inputText = '') => {
  let converted = String(inputText);
  Object.keys(BANGLA_DIGIT_MAP).forEach((bnDigit) => {
    converted = converted.replace(new RegExp(bnDigit, 'g'), BANGLA_DIGIT_MAP[bnDigit]);
  });
  return converted;
};

const extractSqftFromTranscript = (normalizedText) => {
  const directSqftMatch = normalizedText.match(
    /(\d+(?:\.\d+)?)\s*(?:sqft|sq\s*ft|square\s*feet|বর্গফুট|বর্গ\s*ফুট|স্কয়ার\s*ফিট|স্কয়ার\s*ফিট|ফিট)/i
  );
  if (directSqftMatch) {
    return Math.max(0, Number(directSqftMatch[1]));
  }

  const roomDimMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|বাই|গুণ|by)\s*(\d+(?:\.\d+)?)/i);
  if (roomDimMatch) {
    return Math.max(0, Number((Number(roomDimMatch[1]) * Number(roomDimMatch[2])).toFixed(2)));
  }

  for (const rule of DIALECT_NORMALIZATION_RULES) {
    const wordNumMatch = normalizedText.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${rule.pattern.source}`, 'i'));
    if (wordNumMatch) {
      return Math.max(0, Number(wordNumMatch[1]) * rule.multiplier);
    }
  }

  const fallbackNumber = normalizedText.match(/\b(\d{2,6})\b/);
  return fallbackNumber ? Number(fallbackNumber[1]) : 0;
};

const extractCoatCount = (normalizedText) => {
  const coatMatch = normalizedText.match(/(\d+)\s*(?:coat|coats|কোট|হাত|বার)/i);
  if (coatMatch) {
    return Math.min(5, Math.max(1, Number(coatMatch[1])));
  }
  if (/এক\s*(?:কোট|হাত)/i.test(normalizedText)) return 1;
  if (/তিন\s*(?:কোট|হাত)/i.test(normalizedText)) return 3;
  return 2;
};

const detectPaintingService = (normalizedText) => {
  const lower = normalizedText.toLowerCase();
  for (const srv of SERVICE_KEYWORDS) {
    if (srv.terms.some((t) => lower.includes(t.toLowerCase()))) {
      return { serviceName: srv.key, slotSqftPerDay: srv.capacity };
    }
  }
  return { serviceName: 'Plastic Paint', slotSqftPerDay: 550 };
};
const transcribeAudioViaApi = async ({ audioUrl, district = 'Dhaka' }) => {
  const apiUrl = process.env.DIALECT_AI_VOICE_API_URL;
  const apiKey = process.env.DIALECT_AI_VOICE_API_KEY;

  if (!audioUrl || !apiUrl || !apiKey) {
    return null;
  }

  try {
    const response = await axios.post(
      apiUrl,
      {
        audioUrl,
        language: 'bn-BD',
        districtHint: district,
        enableDialectNormalization: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    return response.data?.transcript || response.data?.text || null;
  } catch (err) {
    return null;
  }
};

const extractDialectIntent = async ({ audioUrl, text, district = 'Dhaka' }) => {
  let rawTranscript = text ? String(text).trim() : '';

  if (!rawTranscript && audioUrl) {
    const transcribed = await transcribeAudioViaApi({ audioUrl, district });
    if (transcribed) {
      rawTranscript = String(transcribed).trim();
    }
  }

  if (!rawTranscript) {
    return {
      success: false,
      detectedDialect: district,
      transcribedText: '',
      sqft: 0,
      coatCount: 2,
      serviceName: 'Plastic Paint',
      calculatedSlots: 0,
      isMistriOnly: false,
      requiresManualReview: true,
    };
  }

  const normalized = normalizeBanglaNumbers(rawTranscript);
  const sqft = extractSqftFromTranscript(normalized);
  const coatCount = extractCoatCount(normalized);
  const { serviceName, slotSqftPerDay } = detectPaintingService(normalized);

  const isMistriOnly = /(শুধু\s*মিস্ত্রি|মিস্ত্রি\s*শুধু|রং\s*আমার|রং\s*আছে|labour\s*only|mistri\s*only)/i.test(
    normalized
  );

  const coatMultiplier = coatCount > 1 ? 1 + (coatCount - 1) * 0.4 : 1;
  const calculatedSlots =
    sqft > 0 ? Number(((sqft * coatMultiplier) / Math.max(1, slotSqftPerDay)).toFixed(2)) : 0;

  return {
    success: true,
    detectedDialect: district,
    transcribedText: rawTranscript,
    sqft,
    coatCount,
    serviceName,
    slotSqftPerDay,
    calculatedSlots,
    isMistriOnly,
    requiresManualReview: sqft <= 0,
  };
};

module.exports = {
  normalizeBanglaNumbers,
  extractSqftFromTranscript,
  extractCoatCount,
  detectPaintingService,
  extractDialectIntent,
  processVoiceOrder: extractDialectIntent,
};
