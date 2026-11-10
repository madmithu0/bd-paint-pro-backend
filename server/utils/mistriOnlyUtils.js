function isMistri(user) {
  if (!user) return false;
  return user.role === 'mistri';
}

function requireMistri(req, res, next) {
  const user = req.user || null;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  if (!isMistri(user)) {
    return res.status(403).json({ success: false, message: 'Mistri only' });
  }
  return next();
}

function canAccessJob(user, job) {
  if (!user || !job) return false;
  if (!isMistri(user)) return false;
  const userId = String(user._id || user.id || '');
  const mistriId = String(job.mistri || job.mistriId || job.assignedTo || '');
  const workerId = String(job.worker || '');
  if (job.status === 'open') return true;
  return userId !== '' && (userId === mistriId || userId === workerId);
}

function filterMistriJobs(user, jobs) {
  if (!isMistri(user)) return [];
  const list = Array.isArray(jobs) ? jobs : [];
  return list.filter((job) => canAccessJob(user, job));
}

function mistriShare(total, percent) {
  const t = Number(total) || 0;
  const p = Number(percent) || 80;
  if (t <= 0) return 0;
  return Math.round((t * p) / 100);
}

function mistriJobSummary(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  let totalEarning = 0;
  let completed = 0;
  let pending = 0;
  for (const job of list) {
    if (job.status === 'completed' || job.status === 'resolved') {
      completed += 1;
      totalEarning += Number(job.mistriShare || job.amount || 0);
    } else {
      pending += 1;
    }
  }
  return { total: list.length, completed, pending, totalEarning };
}

module.exports = { isMistri, requireMistri, canAccessJob, filterMistriJobs, mistriShare, mistriJobSummary };