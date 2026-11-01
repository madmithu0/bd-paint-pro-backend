export const ROLES = Object.freeze({
  SUPER_ADMIN: 'superAdmin',
  AGENT: 'agent',
  MISTRI: 'mistri',
  CUSTOMER: 'customer',
});

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    return next();
  };
}
