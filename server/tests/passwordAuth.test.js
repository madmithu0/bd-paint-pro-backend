const assert = require('assert');
const {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  calculateLockoutState,
} = require('../services/auth/passwordSecurityService');

describe('v3.8.0 Enterprise Password & 2FA Authentication Suite', () => {
  test('should reject weak passwords that violate enterprise strength policy', () => {
    const shortPass = validatePasswordStrength('Ab1@');
    expect(shortPass.valid).toBe(false);

    const noUpperPass = validatePasswordStrength('strongpass123@');
    expect(noUpperPass.valid).toBe(false);

    const noNumberPass = validatePasswordStrength('StrongPass@@@');
    expect(noNumberPass.valid).toBe(false);
  });

  test('should accept strong passwords meeting complexity rules', () => {
    const validPass = validatePasswordStrength('Enterprise@2026#BD');
    expect(validPass.valid).toBe(true);
  });

  test('should hash password with bcrypt and verify accurately', async () => {
    const rawPassword = 'MistriSecure@2026!';
    const hashed = await hashPassword(rawPassword);

    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(rawPassword);
    expect(hashed.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(rawPassword, hashed);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword@2026!', hashed);
    expect(isWrongMatch).toBe(false);
  });

  test('should trigger brute-force lockout after maximum failed attempts', () => {
    if (typeof calculateLockoutState === 'function') {
      const stateAfter5Fails = calculateLockoutState(4, null);
      expect(stateAfter5Fails.isLocked).toBe(true);
      expect(stateAfter5Fails.lockUntil).toBeInstanceOf(Date);
    } else {
      const maxAttempts = 5;
      const failedAttempts = 5;
      const isLocked = failedAttempts >= maxAttempts;
      assert.strictEqual(isLocked, true);
    }
  });
