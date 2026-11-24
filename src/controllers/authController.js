const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/helpers');

const signAccess = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' });
const signRefresh = (u) => jwt.sign({ id: u._id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function issueTokens(user, res, status = 200) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  user.refreshTokenHash = hash(refreshToken); // only a hash of the refresh token is stored
  await user.save({ validateBeforeSave: false });
  res.status(status).json({
    success: true,
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken },
  });
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body; // role limited to customer/seller by validation
  if (await User.findOne({ email })) throw new AppError('Email already registered', 409);
  const user = await User.create({ name, email, password, role });
  await issueTokens(user, res, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Account is deactivated', 403);
  await issueTokens(user, res);
});

// Refresh-token rotation: old refresh token is invalidated when a new pair is issued
exports.refresh = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (e) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== hash(req.body.refreshToken)) {
    throw new AppError('Refresh token is no longer valid', 401);
  }
  await issueTokens(user, res);
});

exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { refreshTokenHash: 1 } });
  res.json({ success: true, message: 'Logged out' });
});
