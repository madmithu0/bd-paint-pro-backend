const axios = require('axios');
const CircuitBreaker = require('opossum');

const executeBiometricRequest = async ({ endpoint, payload }) => {
  const apiUrl = process.env.BIOMETRIC_API_URL;
  const apiKey = process.env.FACE_VOICE_API_KEY;

  // If external Biometric API URL is configured, perform live verification call
  if (apiUrl && apiKey && !apiKey.startsWith('your_')) {
    const response = await axios.post(`${apiUrl}${endpoint}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Biometric-API-Key': apiKey,
      },
      timeout: 12000,
    });
    return response.data;
  }

  // Dev/Sandbox Verification Simulator when external key is not yet attached
  if (process.env.DEV_MODE === 'true') {
    if (endpoint === '/verify-voice') {
      const isFake = String(payload.audioBase64 || '').includes('FAKE_RECORDED');
      return { isLive: !isFake, score: isFake ? 0.42 : 0.95 };
    }
    if (endpoint === '/verify-face-3d') {
      const isPhoto = String(payload.videoBase64 || '').includes('STATIC_PHOTO');
      return {
        headMovementVerified: !isPhoto,
        eyeBlinkVerified: !isPhoto,
        score: isPhoto ? 0.35 : 0.96,
      };
    }
  }

  throw new Error('Biometric API unavailable. Use Offline Hardware Recovery Key if emergency.');
};

const biometricBreaker = new CircuitBreaker(executeBiometricRequest, {
  timeout: 12000,
  errorThresholdPercentage: 50,
  resetTimeout: 20000,
});

biometricBreaker.fallback(() => ({
  isLive: false,
  headMovementVerified: false,
  eyeBlinkVerified: false,
  score: 0,
  serviceDown: true,
  message: 'Biometric engine timeout. Use Offline Hardware Recovery Key fallback.',
}));

const callBiometricProvider = async (endpoint, payload) => {
  return biometricBreaker.fire({ endpoint, payload });
};

module.exports = { callBiometricProvider };
