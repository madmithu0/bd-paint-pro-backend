const express = require('express');
const router = express.Router();
const team = require('../controllers/teamController');

function validateTeam(req, res, next) {
  if (!req.body?.name || !req.body?.leaderId) {
    return res.status(400).json({ success: false, message: 'Name and leaderId required' });
  }
  next();
}

router.post('/', validateTeam, team.create);
router.get('/', team.list);
router.get('/:id', team.details);
router.patch('/:id/member', (req, res, next) => {
  if (!req.body?.userId) return res.status(400).json({ success: false, message: 'userId required' });
  next();
}, team.addMember);
router.delete('/:id/member/:userId', team.removeMember);

module.exports = router;