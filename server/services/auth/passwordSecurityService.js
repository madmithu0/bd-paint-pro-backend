const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

const validatePasswordStrength = (password) => {
  const raw = String(password || '');
  if (raw.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long.',
    };
  }
  if (!/[A-Z]/.test(raw)) {
    return {
      valid: false,
      message: 'Password must include at least one uppercase letter.',
    };
  }
  if (!/[a-z]/.test(raw)) {
    return {
      valid: false,
      message: 'Password must include at least one lowercase letter.',
    };
  }
  if (!/[0-9]/.test(raw)) {
    return {
      valid: false,
      message: 'Password must include at least one numeric digit.',
    };
  }
  if (!/[^A-Za-z0-9]/.test(raw)) {
    return {
      valid: false,
      message: 'Password must include at least one special character.',
    };
  }
  return { valid: true, message: 'Strong password.' };
};

const hashPassword = async (plainPassword) => {
  const raw = String(plainPassword || '');
  if (!raw) {
    throw new Error('Password cannot be empty.');
  }
  return bcrypt.hash(raw, SALT_ROUNDS);
};

const verifyPassword = async (plainPassword, hashedPassword) => {
  if (!plainPassword || !hashedPassword) {
    return false;
  }
  return bcrypt.compare(String(plainPassword), String(hashedPassword));
};

const calculateLockoutState = (currentFailedAttempts = 0, existingLockUntil = null) => {
  const now = new Date();
  if (existingLockUntil && new Date(existingLockUntil) > now) {
    return {
      isLocked: true,
      failedAttempts: currentFailedAttempts,
      lockUntil: new Date(existingLockUntil),
    };
  }

  const nextAttempts = Number(currentFailedAttempts) + 1;
  if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      isLocked: true,
      failedAttempts: nextAttempts,
      lockUntil: new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000),
    };
  }

  return {
    isLocked: false,
    failedAttempts: nextAttempts,
    lockUntil: null,
  };
};

module.exports = {
  SALT_ROUNDS,
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MINUTES,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  calculateLockoutState,
};
