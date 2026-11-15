const HIDE_AFTER_MINUTES = Number(process.env.HIDE_AFTER_MINUTES) || 5;
const DEV_MODE = process.env.DEV_MODE === 'true';

let hideState = {
  isHidden: false,
  autoHideEnabled: true,
  bootTimestamp: Date.now(),
  autoHideTriggerAt: Date.now() + HIDE_AFTER_MINUTES * 60 * 1000,
  logs: [],
};

let autoHideTimeoutRef = null;

const addHideLog = (action, actorIp, reason) => {
  hideState.logs.unshift({
    action,
    actorIp: actorIp || 'SYSTEM',
    reason,
    timestamp: new Date().toISOString(),
  });
  if (hideState.logs.length > 100) {
    hideState.logs.pop();
  }
};

const hideConfig = {
  startAutoHideTimer() {
    if (DEV_MODE) {
      console.log('👁️  [HIDE SYSTEM] DEV_MODE is true — Auto-Hide timer paused.');
      return;
    }

    if (autoHideTimeoutRef) clearTimeout(autoHideTimeoutRef);

    hideState.bootTimestamp = Date.now();
    hideState.autoHideTriggerAt = hideState.bootTimestamp + HIDE_AFTER_MINUTES * 60 * 1000;

    autoHideTimeoutRef = setTimeout(() => {
      if (hideState.autoHideEnabled && !hideState.isHidden) {
        hideState.isHidden = true;
        addHideLog('AUTO_HIDE_ON', 'SYSTEM_TIMER', `Auto-hidden after ${HIDE_AFTER_MINUTES} minutes of boot`);
        console.log(`🔒 [HIDE SYSTEM] Super Admin interface is now HIDDEN (${HIDE_AFTER_MINUTES} min elapsed).`);
      }
    }, HIDE_AFTER_MINUTES * 60 * 1000);
  },

  setHideStatus(status, actorIp = 'SUPER_ADMIN', reason = 'Manual toggle') {
    hideState.isHidden = Boolean(status);
    addHideLog(hideState.isHidden ? 'MANUAL_HIDE_ON' : 'MANUAL_UNHIDE', actorIp, reason);
    return hideState.isHidden;
  },

  toggleAutoHide(enabled) {
    hideState.autoHideEnabled = Boolean(enabled);
    if (hideState.autoHideEnabled && !hideState.isHidden) {
      this.startAutoHideTimer();
    }
    return hideState.autoHideEnabled;
  },

  isHidden() {
    if (DEV_MODE) return false;
    return hideState.isHidden;
  },

  // Can only view hidden interface if Super Admin ID + Whitelisted IP + Valid Secret Header/Token match
  canSeeHidden({ adminId, clientIp, secretToken }) {
    if (!this.isHidden()) return true;

    const validId = process.env.SUPER_ADMIN_ID && adminId === process.env.SUPER_ADMIN_ID;
    const allowedIps = (process.env.SUPER_ADMIN_IP || '').split(',').map((ip) => ip.trim());
    const validIp = allowedIps.includes(clientIp);
    const validToken = Boolean(secretToken && secretToken.length >= 20);

    return Boolean(validId && validIp && validToken);
  },

  getStatus() {
    const remainingMs = Math.max(0, hideState.autoHideTriggerAt - Date.now());
    return {
      isHidden: this.isHidden(),
      autoHideEnabled: hideState.autoHideEnabled,
      devMode: DEV_MODE,
      hideAfterMinutes: HIDE_AFTER_MINUTES,
      remainingSeconds: hideState.isHidden ? 0 : Math.ceil(remainingMs / 1000),
      recentLogs: hideState.logs.slice(0, 20),
    };
  },
};

module.exports = hideConfig;
