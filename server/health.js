import { Router } from 'express';
import { db } from './connectDB.js';

const router = Router();

router.get('/api/health', async (req, res) => {
  const { error } = await db.from('audit_logs').select('id', { head: true, count: 'exact' }).limit(1);
  const databaseOk = !error;
  res.status(databaseOk ? 200 : 503).json({
    status: 'BD Paint Pro Backend Running',
    database: databaseOk ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
