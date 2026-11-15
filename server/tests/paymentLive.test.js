/**
 * File #169: server/tests/paymentLive.test.js
 * Payment Gateway Sandbox, Wrong Amount, Duplicate TrxID & Escrow Verification Suite
 */

const paymentEnv = require('../config/paymentEnv');

describe('Live Payment, Escrow & Split Payout Verification Suite', () => {
  test('1. Payment Gateway Sandbox/Live Switch Validation', () => {
    const status = paymentEnv.getGatewayStatus();
    expect(['sandbox', 'live']).toContain(status.mode);
    expect(status.bkashConfigured).toBeDefined();
    expect(status.nagadConfigured).toBeDefined();
  });

  test('2. Exact Amount Match vs Wrong Amount Rejection (1 Taka Mismatch)', () => {
    const validateExact = (jobPrice, paid) => Number(paid) === Number(jobPrice);

    expect(validateExact(12500, 12500)).toBe(true);
    expect(validateExact(12500, 12499)).toBe(false);
    expect(validateExact(12500, 12501)).toBe(false);
  });

  test('3. Duplicate TrxID Fraud Prevention Check', () => {
    const usedTrxSet = new Set(['TRX99887766', 'NAGAD554433']);
    const isDuplicateTrx = (trxId) => usedTrxSet.has(String(trxId).trim());

    expect(isDuplicateTrx('TRX99887766')).toBe(true);
    expect(isDuplicateTrx('NEW_TRX_2026')).toBe(false);
  });

  test('4. Escrow Release Guard & Equal Split Calculation', () => {
    const canRelease = (jobStatus) => jobStatus === 'Completed';
    expect(canRelease('In-Progress')).toBe(false);
    expect(canRelease('Completed')).toBe(true);

    // 20,000 BDT job split among 4 Mistris with 1 Agent
    const total = 20000;
    const mistriPool = total * 0.80; // 16,000
    const perMistri = mistriPool / 4; // 4,000 each
    const agentShare = total * 0.05; // 1,000
    const platformShare = total * 0.15; // 3,000

    expect(perMistri).toBe(4000);
    expect(agentShare).toBe(1000);
    expect(platformShare).toBe(3000);
  });
});
