const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = generateToken;