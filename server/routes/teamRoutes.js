const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { requireRole } = require('../middleware/authMiddleware');

// @route   POST /api/v1/teams
// @desc    Create a new Mistri Team
// @access  Protected (Mistri / Agent)
router.post('/', requireRole(['Mistri', 'Agent']), teamController.createTeam);

// @route   GET /api/v1/teams
// @desc    Get List of Teams
// @access  Protected
router.get('/', teamController.getTeamList);

// @route   GET /api/v1/teams/:id
// @desc    Get Single Team Details & Members
// @access  Protected
router.get('/:id', teamController.getTeamDetails);

// @route   POST /api/v1/teams/:id/members
// @desc    Add a Member to the Team
// @access  Protected (Mistri Leader / Agent)
router.post('/:id/members', requireRole(['Mistri', 'Agent']), teamController.addTeamMember);

// @route   DELETE /api/v1/teams/:id/members/:memberId
// @desc    Remove a Member from the Team
// @access  Protected (Mistri Leader / Agent)
router.delete('/:id/members/:memberId', requireRole(['Mistri', 'Agent']), teamController.removeTeamMember);

module.exports = router;
