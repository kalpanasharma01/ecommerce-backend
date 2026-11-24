const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/helpers');

// Authentication: verifies the Bearer access token and loads the user
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError('Authentication required', 401);
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_ACCESS_SECRET);
  } catch (e) {
    throw new AppError('Invalid or expired token', 401);
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new AppError('User no longer exists or is deactivated', 401);
  req.user = user;
  next();
});

// Authorization (RBAC): allow only the listed roles
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new AppError('You do not have permission to perform this action', 403));
  next();
};
