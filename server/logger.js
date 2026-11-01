import { db } from './connectDB.js';

export async function logEvent(level, event, { ip = null, details = {} } = {}) {
  const entry = { time: new Date().toISOString(), level, event, ip, details };
  if (level === 'error' || level === 'security') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }

  try {
    const { error } = await db.from('audit_logs').insert({ level, event, ip, details });
    if (error) console.error('Failed to write audit log:', error.message);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}
