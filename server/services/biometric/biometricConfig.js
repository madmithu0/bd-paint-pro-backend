const SERVER_BOOT_TIMESTAMP = Date.now();
const ENROLL_MINUTES = Number(process.env.VOICE_ENROLL_MINUTES) > 0
  ? Number(process.env.VOICE_ENROLL_MINUTES)
  : 10;

const biometricConfig = Object.freeze({
  versionLock: 'v3.0.0-BIOMETRIC-LOCK',
  voiceThresholdLock: 0.90,
  faceThresholdLock: 0.90,
  livenessLock: true,
  minVoiceDurationSeconds: 5,
  requiredHeadDirections: ['LEFT', 'RIGHT', 'UP', 'DOWN'],
  requireEyeBlink: true,
  rejectStaticPhotos: true,
  rejectPreRecordedAudio: true,

  // Master Voice 10-Minute Enrollment & Lifetime Lock Rules
  lifetimeVoiceLock: true,
  voiceEnrollWindowMinutes: ENROLL_MINUTES,
  voiceEnrollWindowMs: ENROLL_MINUTES * 60 * 1000,
  serverBootTimestamp: SERVER_BOOT_TIMESTAMP,
  voiceEnrollDeadline: SERVER_BOOT_TIMESTAMP + ENROLL_MINUTES * 60 * 1000,
  masterVoiceAuditKey: 'SUPER_ADMIN_MASTER_VOICE_LOCKED',

  isVoiceEnrollmentWindowOpen() {
    return Date.now() <= this.voiceEnrollDeadline;
  },

  getRemainingEnrollSeconds() {
    const remainingMs = this.voiceEnrollDeadline - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  },
});

module.exports = biometricConfig;
