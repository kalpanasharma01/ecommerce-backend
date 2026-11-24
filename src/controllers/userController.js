const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/helpers');

exports.getMe = asyncHandler(async (req, res) => res.json({ success: true, data: req.user }));

exports.updateMe = asyncHandler(async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  res.json({ success: true, data: req.user });
});

// ----- admin only -----
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).sort('-createdAt');
  res.json({ success: true, count: users.length, data: users });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw new AppError('Admins cannot modify their own role or status', 400);
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw new AppError('Admins cannot delete themselves', 400);
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: 'User deleted' });
});
