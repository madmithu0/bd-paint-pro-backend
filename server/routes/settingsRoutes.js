const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getAuditLogs,
  getUsers,
  updateUser
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getSettings);
router.put('/', upload.single('logo'), updateSettings);
router.get('/audit-logs', getAuditLogs);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);

module.exports = router;