const Setting = require('../models/Setting');
const KillSwitchLog = require('../models/KillSwitchLog');

const killSwitchCheck = async (req, res, next) => {
  try {
    // Check if kill switch is active
    const killSwitch = await Setting.findOne({ key: 'kill_switch_active' });
    
    if (killSwitch && killSwitch.value === true) {
      // Allow super_admin and admin to bypass
      if (req.user && ['super_admin', 'admin'].includes(req.user.role)) {
        return next();
      }

      // Allow kill switch status check route
      if (req.path.includes('kill-switch/status')) {
        return next();
      }

      return res.status(503).json({
        success: false,
        message: 'Service temporarily paused by admin. Please try again later.',
        killSwitchActive: true
      });
    }

    next();
  } catch (error) {
    console.error('KillSwitch middleware error:', error.message);
    // If error, allow request to pass to avoid blocking all traffic
    next();
  }
};

const checkServiceKillSwitch = async (req, res, next) => {
  try {
    const serviceId = req.params.serviceId || req.body.serviceId;
    
    if (!serviceId) {
      return next();
    }

    const serviceSwitch = await Setting.findOne({ 
      key: `kill_switch_service_${serviceId}` 
    });

    if (serviceSwitch && serviceSwitch.value === true) {
      if (req.user && ['super_admin', 'admin'].includes(req.user.role)) {
        return next();
      }

      return res.status(503).json({
        success: false,
        message: 'This service is temporarily unavailable',
        killSwitchActive: true
      });
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { killSwitchCheck, checkServiceKillSwitch };