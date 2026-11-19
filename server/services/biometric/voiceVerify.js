const crypto = require('crypto');
const biometricConfig = require('../../config/biometricConfig');
const AuditLog = require('../../models/AuditLog');
const { callBiometricProvider } = require('./biometricApi');

let cachedMasterVoice = null;

const generateVoiceHash = (voiceBufferOrBase64) => {
  return crypto
    .createHash('sha256')
    .update(String(voiceBufferOrBase64 || ''))
    .digest('hex');
};

const normalizeText = (text) => {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getMasterVoiceRecord = async () => {
  if (cachedMasterVoice && cachedMasterVoice.voiceHash) {
    return cachedMasterVoice;
  }

  const dbRecord = await AuditLog.findOne({
    action: biometricConfig.masterVoiceAuditKey,
    category: 'BIOMETRIC_LOCK',
    isImmutableLock: true,
  })
    .sort({ time: 1 })
    .lean();

  if (dbRecord && dbRecord.details && dbRecord.details.voiceHash) {
    cachedMasterVoice = {
      voiceHash: dbRecord.details.voiceHash,
      passphrase: dbRecord.details.passphrase || '',
      lockedAt: dbRecord.time,
      lockedByIp: dbRecord.ipAddress,
    };
    return cachedMasterVoice;
  }

  const envFallback = (process.env.SUPER_ADMIN_VOICE_DATA || '').trim();
  if (envFallback && !envFallback.startsWith('your_')) {
    return {
      voiceHash: envFallback,
      passphrase: '',
      lockedAt: null,
      lockedByIp: 'ENV_FALLBACK',
    };
  }

  return null;
};
const getVoiceEnrollmentStatus = async () => {
  const existing = await getMasterVoiceRecord();
  const isLocked = Boolean(existing && existing.voiceHash);
  const windowOpen = !isLocked && biometricConfig.isVoiceEnrollmentWindowOpen();
  const remainingSeconds = windowOpen ? biometricConfig.getRemainingEnrollSeconds() : 0;

  return {
    isLocked,
    canEnroll: windowOpen,
    remainingSeconds,
    lockedAt: existing ? existing.lockedAt : null,
    deadlineTimestamp: biometricConfig.voiceEnrollDeadline,
  };
};

const enrollMasterVoice = async ({
  voiceSampleBase64,
  transcript = '',
  isPreRecorded = false,
  actorIp = '0.0.0.0',
  deviceInfo = 'Unknown Device',
}) => {
  try {
    const existing = await getMasterVoiceRecord();
    if (existing && existing.voiceHash) {
      return {
        enrolled: false,
        reason: 'MASTER_VOICE_ALREADY_LOCKED',
        message: 'Master voice is already permanently locked for lifetime. Changes are forbidden.',
      };
    }

    if (!biometricConfig.isVoiceEnrollmentWindowOpen()) {
      return {
        enrolled: false,
        reason: 'ENROLLMENT_WINDOW_EXPIRED',
        message: `Initial ${biometricConfig.voiceEnrollWindowMinutes}-minute voice enrollment window has expired.`,
      };
    }

    if (biometricConfig.livenessLock && isPreRecorded === true) {
      return {
        enrolled: false,
        reason: 'LIVENESS_FAILED_RECORDED_VOICE_REJECTED',
        message: 'Pre-recorded audio cannot be enrolled. Live 5-second voice recording is required.',
      };
    }

    if (!voiceSampleBase64 || String(voiceSampleBase64).length < 500) {
      return {
        enrolled: false,
        reason: 'MISSING_OR_SHORT_VOICE_SAMPLE',
        message: 'Valid 5-second live voice recording is required for master enrollment.',
      };
    }

    const incomingHash = generateVoiceHash(voiceSampleBase64);

    const apiResult = await callBiometricProvider('/verify-voice', {
      audioBase64: voiceSampleBase64,
      expectedTranscript: transcript,
      enrolledVoiceHash: incomingHash,
      minDurationSeconds: biometricConfig.minVoiceDurationSeconds || 5,
      mode: 'ENROLLMENT',
    });

    const livenessPassed = apiResult.isLive === true;
    const qualityScore = Number(apiResult.score || 0);
    const requiredThreshold = Number(biometricConfig.voiceThresholdLock || 0.90);

    if (!livenessPassed || qualityScore < requiredThreshold) {
      return {
        enrolled: false,
        reason: !livenessPassed ? 'VOICE_SPOOF_DETECTED' : 'VOICE_QUALITY_BELOW_0_90',
        message: `Live voice enrollment rejected (Score: ${qualityScore}, Required: >= ${requiredThreshold}).`,
      };
    }

    const cleanPhrase = normalizeText(transcript);
    const lockTimestamp = new Date();

    await AuditLog.create({
      user: process.env.SUPER_ADMIN_ID || 'SUPER_ADMIN',
      role: 'SuperAdmin',
      action: biometricConfig.masterVoiceAuditKey,
      category: 'BIOMETRIC_LOCK',
      ipAddress: actorIp,
      deviceInfo,
      isImmutableLock: true,
      time: lockTimestamp,
      details: {
        voiceHash: incomingHash,
        passphrase: cleanPhrase,
        qualityScore,
        versionLock: biometricConfig.versionLock,
        lockType: 'LIFETIME_IMMUTABLE',
      },
    });

    cachedMasterVoice = {
      voiceHash: incomingHash,
      passphrase: cleanPhrase,
      lockedAt: lockTimestamp,
      lockedByIp: actorIp,
    };

    return {
      enrolled: true,
      isLocked: true,
      score: qualityScore,
      message: 'Master Voice enrolled and permanently locked for lifetime.',
    };
  } catch (error) {
    return {
      enrolled: false,
      reason: 'VOICE_ENROLL_ERROR',
      message: error.message || 'Failed to enroll master voice.',
    };
  }
};
const verifyVoiceBiometric = async ({ voiceSampleBase64, transcript = '', isPreRecorded = false }) => {
  try {
    const masterRecord = await getMasterVoiceRecord();

    if (!masterRecord || !masterRecord.voiceHash) {
      const windowOpen = biometricConfig.isVoiceEnrollmentWindowOpen();
      return {
        verified: false,
        score: 0,
        needsEnrollment: windowOpen,
        reason: windowOpen ? 'MASTER_VOICE_NOT_ENROLLED_YET' : 'MASTER_VOICE_MISSING_WINDOW_CLOSED',
        message: windowOpen
          ? 'Master voice is not set yet. Complete initial voice enrollment within the 10-minute window.'
          : 'Master voice was not enrolled within the initial 10-minute window. Use Offline Hardware Recovery Key.',
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

    if (!voiceSampleBase64 || String(voiceSampleBase64).length < 500) {
      return {
        verified: false,
        score: 0,
        reason: 'MISSING_OR_SHORT_VOICE_SAMPLE',
        message: 'Valid 5-second live voice recording is required.',
      };
    }

    const incomingHash = generateVoiceHash(voiceSampleBase64);
    if (incomingHash === masterRecord.voiceHash) {
      return {
        verified: false,
        score: 0,
        reason: 'REPLAY_ATTACK_IDENTICAL_AUDIO_BLOCKED',
        message: 'Identical pre-recorded voice sample detected and blocked.',
      };
    }

    if (masterRecord.passphrase && transcript) {
      const spokenPhrase = normalizeText(transcript);
      if (spokenPhrase && spokenPhrase !== masterRecord.passphrase) {
        return {
          verified: false,
          score: 0,
          reason: 'VOICE_PASSPHRASE_MISMATCH',
          message: 'Spoken passphrase does not match the locked master voice phrase.',
        };
      }
    }

    const apiResult = await callBiometricProvider('/verify-voice', {
      audioBase64: voiceSampleBase64,
      expectedTranscript: transcript || masterRecord.passphrase,
      enrolledVoiceHash: masterRecord.voiceHash,
      minDurationSeconds: biometricConfig.minVoiceDurationSeconds || 5,
      mode: 'VERIFY',
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
      message: 'Live Voice Biometric Verified against Lifetime Master Voice (>= 0.90).',
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
  enrollMasterVoice,
  getVoiceEnrollmentStatus,
  getMasterVoiceRecord,
  generateVoiceHash,
};
