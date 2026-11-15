const crypto = require('crypto');
const biometricConfig = require('../../config/biometricConfig');
const { callBiometricProvider } = require('./biometricApi');

const generateVoiceHash = (voiceBufferOrBase64) => {
  return crypto
    .createHash('sha256')
    .update(String(voiceBufferOrBase64 || ''))
    .digest('hex');
};

const verifyVoiceBiometric = async ({ voiceSampleBase64, transcript = '', isPreRecorded = false }) => {
  try {
    // 1. Strict Liveness Guard: Reject pre-recorded audio immediately
    if (biometricConfig.livenessLock && isPreRecorded === true) {
      return {
        verified: false,
        score: 0,
        reason: 'LIVENESS_FAILED_RECORDED_VOICE_REJECTED',
        message: 'Pre-recorded audio is strictly prohibited. Live 5-second voice required.',
      };
    }

    if (!voiceSampleBase64 || String(voiceSampleBase64).length < 50) {
      return {
        verified: false,
        score: 0,
        reason: 'MISSING_OR_SHORT_VOICE_SAMPLE',
        message: 'Valid 5-second live voice recording is required.',
      };
    }

    // 2. Call External Biometric Voice Liveness & Speaker Match API
    const apiResult = await callBiometricProvider('/verify-voice', {
      audioBase64: voiceSampleBase64,
      expectedTranscript: transcript,
      enrolledVoiceHash: process.env.SUPER_ADMIN_VOICE_HASH,
      minDurationSeconds: biometricConfig.minVoiceDurationSeconds,
    });

    const matchScore = Number(apiResult.score || 0);
    const livenessPassed = apiResult.isLive === true;

    // 3. Enforce 0.90 Score Lock
    if (!livenessPassed || matchScore < biometricConfig.voiceThresholdLock) {
      return {
        verified: false,
        score: matchScore,
        reason: !livenessPassed ? 'VOICE_SPOOF_DETECTED' : 'VOICE_SCORE_BELOW_0_90',
        message: `Voice verification failed (Score: ${matchScore}, Required: >= ${biometricConfig.voiceThresholdLock}).`,
      };
    }

    return {
      verified: true,
      score: matchScore,
      voiceHash: generateVoiceHash(voiceSampleBase64),
      message: 'Live Voice Biometric Verified (>= 0.90).',
    };
  } catch (error) {
    return {
      verified: false,
      score: 0,
      reason: 'VOICE_SERVICE_ERROR',
      message: error.message,
    };
  }
};

module.exports = {
  verifyVoiceBiometric,
  generateVoiceHash,
};
