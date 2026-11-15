const biometricConfig = require('../../config/biometricConfig');
const { callBiometricProvider } = require('./biometricApi');

const verifyFace3DBiometric = async ({
  faceVideoBase64,
  mediaType = 'video/webm',
  headMovements = [],
  eyeBlinkDetected = false,
}) => {
  try {
    // 1. Strict Static Photo Block: Only live video streams are accepted
    if (String(mediaType).startsWith('image/') || !faceVideoBase64) {
      return {
        verified: false,
        score: 0,
        reason: 'STATIC_PHOTO_REJECTED_VIDEO_REQUIRED',
        message: 'Static photos are not accepted. Live 3D face video with head movement is required.',
      };
    }

    // 2. Call External 3D Liveness & Head Pose Verification API
    const apiResult = await callBiometricProvider('/verify-face-3d', {
      videoBase64: faceVideoBase64,
      enrolledFaceMesh: process.env.SUPER_ADMIN_3D_FACE_DATA,
      clientHeadMovements: headMovements,
      clientBlinkFlag: eyeBlinkDetected,
      requireHeadTurn: true,
      requireEyeBlink: true,
    });

    const livenessScore = Number(apiResult.score || 0);
    const headMoveOk = apiResult.headMovementVerified === true;
    const blinkOk = apiResult.eyeBlinkVerified === true;

    // 3. Enforce 0.90 Score Lock + Active Liveness Challenges
    if (!headMoveOk || !blinkOk || livenessScore < biometricConfig.faceThresholdLock) {
      return {
        verified: false,
        score: livenessScore,
        reason: !headMoveOk
          ? 'HEAD_MOVEMENT_NOT_DETECTED'
          : !blinkOk
          ? 'EYE_BLINK_NOT_DETECTED'
          : 'FACE_LIVENESS_BELOW_0_90',
        message: `3D Face verification failed (Score: ${livenessScore}, Required: >= ${biometricConfig.faceThresholdLock}).`,
      };
    }

    return {
      verified: true,
      score: livenessScore,
      headMovementVerified: true,
      eyeBlinkVerified: true,
      message: 'Live 3D Face Biometric Verified (>= 0.90).',
    };
  } catch (error) {
    return {
      verified: false,
      score: 0,
      reason: 'FACE_3D_SERVICE_ERROR',
      message: error.message,
    };
  }
};

module.exports = { verifyFace3DBiometric };
