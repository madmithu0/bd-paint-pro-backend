const AuditLog = require('../models/AuditLog');

const writeAuditLog = async ({
  user = 'SYSTEM',
  role = 'System',
  action,
  category = 'GENERAL',
  ipAddress = '127.0.0.1',
  deviceInfo = 'Server Process',
  details = {},
}) => {
  try {
    return await AuditLog.create({
      user: String(user),
      role,
      action,
      category,
      ipAddress,
      deviceInfo,
      details,
      time: new Date(),
    });
  } catch (err) {
    console.error('[AUDIT WRITE ERROR]:', err.message);
    return null;
  }
};

const getAuditLogList = async ({ category, user, limit = 100 }) => {
  const filter = {};
  if (category) filter.category = category;
  if (user) filter.user = user;

  return AuditLog.find(filter).sort({ time: -1 }).limit(Number(limit)).lean();
};

const exportAuditLogsCsv = async (filter = {}) => {
  const logs = await AuditLog.find(filter).sort({ time: -1 }).limit(1000).lean();
  const header = 'Time,User,Role,Category,Action,IP Address\n';
  const rows = logs
    .map(
      (l) =>
        `"${new Date(l.time).toISOString()}","${l.user}","${l.role}","${l.category}","${l.action.replace(/"/g, '""')}","${l.ipAddress}"`
    )
    .join('\n');

  return header + rows;
};

module.exports = {
  writeAuditLog,
  getAuditLogList,
  exportAuditLogsCsv,
};
