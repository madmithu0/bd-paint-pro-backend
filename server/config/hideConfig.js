const HIDE_AFTER_MINUTES = 0;
const DEV_MODE = process.env.DEV_MODE === 'true';

const hideState = {
  isHidden: false,
  autoHideEnabled: false,
  bootTimestamp: Date.now(),
  autoHideTriggerAt: null,
  logs: [],
};

let autoHideTimeoutRef = null;

const addHideLog = (action, actorIp, reason) => {
  hideState.logs.unshift({
    action,
    actorIp: actorIp || 'SYSTEM',
    reason: reason || 'System state update',
    timestamp: new Date().toISOString(),
  });
  if (hideState.logs.length > 100) {
    hideState.logs.pop();
  }
};

const hideConfig = {
  startAutoHideTimer() {
    if (autoHideTimeoutRef) {
      clearTimeout(autoHideTimeoutRef);
      autoHideTimeoutRef = null;
    }
    hideState.autoHideEnabled = false;
    hideState.isHidden = false;
    hideState.bootTimestamp = Date.now();
    hideState.autoHideTriggerAt = null;
    console.log('[HIDE SYSTEM] Auto-Hide timer is permanently disabled.');
  },

  setHideStatus(status, actorIp = 'SUPER_ADMIN', reason = 'Manual toggle') {
    hideState.isHidden = Boolean(status);
    addHideLog(
      hideState.isHidden ? 'MANUAL_HIDE_ON' : 'MANUAL_UNHIDE',
      actorIp,
      reason
    );
    return hideState.isHidden;
  },

  toggleAutoHide() {
    if (autoHideTimeoutRef) {
      clearTimeout(autoHideTimeoutRef);
      autoHideTimeoutRef = null;
    }
    hideState.autoHideEnabled = false;
    return false;
  },

  isHidden() {
    return Boolean(hideState.isHidden);
  },

  canSeeHidden(params = {}) {
    if (!this.isHidden()) return true;

    const { adminId, clientIp, secretToken } = params;
    const configuredAdminId = (process.env.SUPER_ADMIN_ID || '').trim();
    const validId = Boolean(configuredAdminId && adminId === configuredAdminId);

    const rawIps = (process.env.SUPER_ADMIN_IP || '').trim();
    const allowedIps = rawIps
      ? rawIps.split(',').map((ip) => ip.trim()).filter(Boolean)
      : [];
    const validIp = allowedIps.length === 0 || allowedIps.includes(String(clientIp || '').trim());

    const validToken = typeof secretToken === 'string' && secretToken.trim().length >= 20;

    return validId && validIp && validToken;
  },

  getStatus() {
    return {
      isHidden: this.isHidden(),
      autoHideEnabled: false,
      devMode: DEV_MODE,
      hideAfterMinutes: HIDE_AFTER_MINUTES,
      remainingSeconds: 0,
      recentLogs: hideState.logs.slice(0, 20),
    };
  },
};

module.exports = hideConfig;
