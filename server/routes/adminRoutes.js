const express = require('express');
const router = express.Router();

function blocked(req, res) {
  return res.status(410).json({ success: false, message: 'Admin route moved to 161' });
}

router.get('/', blocked);
router.get('/:id', blocked);
router.post('/', blocked);
router.put('/:id', blocked);
router.patch('/:id', blocked);
router.delete('/:id', blocked);

module.exports = router;