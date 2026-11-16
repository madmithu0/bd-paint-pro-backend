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
    const enrolledVoiceData = process.env.SUPER_ADMIN_VOICE_DATA;

    if (!enrolledVoiceData) {
      return {
        verified: false,
        score: 0,
        reason: 'ENROLLED_VOICE_DATA_MISSING',
        message: 'Super Admin voice reference data is missing in server configuration.',
      };
    }

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

    const incomingHash = generateVoiceHash(voiceSampleBase64);
    if (incomingHash === enrolledVoiceData) {
      return {
        verified: false,
        score: 0,
        reason: 'REPLAY_ATTACK_IDENTICAL_AUDIO_BLOCKED',
        message: 'Identical pre-recorded voice sample detected and blocked.',
      };
    }

    const apiResult = await callBiometricProvider('/verify-voice', {
      audioBase64: voiceSampleBase64,
      expectedTranscript: transcript,
      enrolledVoiceHash: enrolledVoiceData,
      minDurationSeconds: biometricConfig.minVoiceDurationSeconds || 5,
    });

    const matchScore = Number(apiResult.score || 0);
    const livenessPassed = apiResult.isLive === true;
    const requiredThreshold = Number(biometricConfig.voiceThresholdLock || 0.90);

    if (!livenessPassed || matchScore < requiredThreshold) {
      return {
        verified: false,
        score: matchScore,
        reason: !livenessPassed ? 'VOICE_SPOOF_DETECTED' : 'VOICE_SCORE_BELOW_0_90',
        message: `Voice verification failed (Score: ${matchScore}, Required: >= ${requiredThreshold}).`,
      };
    }

    return {
      verified: true,
      score: matchScore,
      voiceHash: incomingHash,
      message: 'Live Voice Biometric Verified (>= 0.90).',
    };
  } catch (error) {
    return {
      verified: false,
      score: 0,
      reason: 'VOICE_SERVICE_ERROR',
      message: error.message || 'Biometric voice service encountered an error.',
    };
  }
};

module.exports = {
  verifyVoiceBiometric,
  generateVoiceHash,
};
