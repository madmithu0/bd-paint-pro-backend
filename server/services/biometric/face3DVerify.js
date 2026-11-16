const biometricConfig = require('../../config/biometricConfig');
const { callBiometricProvider } = require('./biometricApi');

const verifyFace3DBiometric = async ({
  faceVideoBase64,
  mediaType = 'video/webm',
  headMovements = [],
  eyeBlinkDetected = false,
}) => {
  try {
    const enrolledFaceData = process.env.SUPER_ADMIN_FACE_3D_DATA;

    if (!enrolledFaceData) {
      return {
        verified: false,
        score: 0,
        reason: 'ENROLLED_FACE_DATA_MISSING',
        message: 'Super Admin 3D face reference data is missing in server configuration.',
      };
    }

    if (String(mediaType).startsWith('image/') || !faceVideoBase64) {
      return {
        verified: false,
        score: 0,
        reason: 'STATIC_PHOTO_REJECTED_VIDEO_REQUIRED',
        message: 'Static photos are not accepted. Live 3D face video with head movement is required.',
      };
    }

    const apiResult = await callBiometricProvider('/verify-face-3d', {
      videoBase64: faceVideoBase64,
      enrolledFaceMesh: enrolledFaceData,
      clientHeadMovements: headMovements,
      clientBlinkFlag: eyeBlinkDetected,
      requireHeadTurn: true,
      requireEyeBlink: true,
    });

    const livenessScore = Number(apiResult.score || 0);
    const headMoveOk = apiResult.headMovementVerified === true;
    const blinkOk = apiResult.eyeBlinkVerified === true;
    const requiredThreshold = Number(biometricConfig.faceThresholdLock || 0.90);

    if (!headMoveOk || !blinkOk || livenessScore < requiredThreshold) {
      return {
        verified: false,
        score: livenessScore,
        reason: !headMoveOk
          ? 'HEAD_MOVEMENT_NOT_DETECTED'
          : !blinkOk
          ? 'EYE_BLINK_NOT_DETECTED'
          : 'FACE_LIVENESS_BELOW_0_90',
        message: `3D Face verification failed (Score: ${livenessScore}, Required: >= ${requiredThreshold}).`,
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
      message: error.message || 'Biometric 3D face service encountered an error.',
    };
  }
};

module.exports = { verifyFace3DBiometric };
