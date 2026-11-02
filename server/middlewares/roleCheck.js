const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
};

// Specific role middlewares
const isAdmin = roleCheck(['super_admin', 'admin', 'manager']);
const isSuperAdmin = roleCheck(['super_admin']);
const isManager = roleCheck(['super_admin', 'admin', 'manager']);
const isAccountant = roleCheck(['super_admin', 'admin', 'accounts']);
const isCustomer = roleCheck(['customer']);
const isMistri = roleCheck(['mistri']);
const isStaff = roleCheck(['super_admin', 'admin', 'manager', 'accounts', 'support']);

module.exports = {
  roleCheck,
  isAdmin,
  isSuperAdmin,
  isManager,
  isAccountant,
  isCustomer,
  isMistri,
  isStaff
};