/**
 * File #177: server/tests/biometric.test.js
 * Super Admin Voice Liveness & 3D Face Movement Verification Suite
 */

process.env.DEV_MODE = 'true';
const { verifyVoiceBiometric } = require('../services/biometric/voiceVerify');
const { verifyFace3DBiometric } = require('../services/biometric/face3DVerify');

describe('Super Admin Biometric Security (Voice & 3D Face) Test Suite', () => {
  test('1. Voice Fake Test: Pre-recorded audio must FAIL', async () => {
    const result = await verifyVoiceBiometric({
      voiceSampleBase64: 'FAKE_RECORDED_AUDIO_STREAM_BASE64_DATA_LONG_STRING_1234567890',
      isPreRecorded: true,
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('LIVENESS_FAILED_RECORDED_VOICE_REJECTED');
  });

  test('2. Live Voice Test: Authentic live 5-sec speech (>= 0.90) must PASS', async () => {
    const result = await verifyVoiceBiometric({
      voiceSampleBase64: 'LIVE_5SEC_AUTHENTIC_VOICE_STREAM_BASE64_PAYLOAD_1234567890_VALID',
      transcript: 'Authorize super admin access',
      isPreRecorded: false,
    });
    expect(result.verified).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.90);
  });

  test('3. Face Photo Test: Static image upload must FAIL', async () => {
    const result = await verifyFace3DBiometric({
      faceVideoBase64: 'STATIC_PHOTO_BASE64_IMAGE_PAYLOAD_1234567890',
      mediaType: 'image/jpeg',
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('STATIC_PHOTO_REJECTED_VIDEO_REQUIRED');
  });

  test('4. Live 3D Face Video Test: Head movement + Eye blink (>= 0.90) must PASS', async () => {
    const result = await verifyFace3DBiometric({
      faceVideoBase64: 'LIVE_WEBCAM_3D_HEAD_TURN_BLINK_VIDEO_BASE64_PAYLOAD_1234567890_VALID',
      mediaType: 'video/webm',
      headMovements: ['LEFT', 'RIGHT', 'UP', 'DOWN'],
      eyeBlinkDetected: true,
    });
    expect(result.verified).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.90);
  });
});
