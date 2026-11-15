const Team = require('../models/Team');

const createTeam = async (req, res, next) => {
  try {
    const { teamName, members = [] } = req.body;
    if (!teamName) {
      return res.status(400).json({ success: false, message: 'Team name is required.' });
    }

    const uniqueMembers = Array.from(new Set([String(req.user.id), ...members.map(String)]));

    const team = await Team.create({
      teamName: String(teamName).trim(),
      leader: req.user.id,
      members: uniqueMembers,
    });

    res.status(201).json({
      success: true,
      message: 'Mistri team created successfully.',
      team,
    });
  } catch (error) {
    next(error);
  }
};

const getTeamList = async (req, res, next) => {
  try {
    const teams = await Team.find({ active: true })
      .populate('leader', 'name phone')
      .populate('members', 'name phone verify')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: teams.length, teams });
  } catch (error) {
    next(error);
  }
};

const getTeamDetails = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leader', 'name phone')
      .populate('members', 'name phone skills verify')
      .lean();

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    res.status(200).json({ success: true, team });
  } catch (error) {
    next(error);
  }
};

const addTeamMember = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: memberId } },
      { new: true }
    ).populate('members', 'name phone');

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    res.status(200).json({ success: true, message: 'Member added to team.', team });
  } catch (error) {
    next(error);
  }
};

const removeTeamMember = async (req, res, next) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $pull: { members: req.params.memberId } },
      { new: true }
    );

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    res.status(200).json({ success: true, message: 'Member removed from team.', team });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTeam,
  getTeamList,
  getTeamDetails,
  addTeamMember,
  removeTeamMember,
};
