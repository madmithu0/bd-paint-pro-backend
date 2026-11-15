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
});

module.exports = biometricConfig;
