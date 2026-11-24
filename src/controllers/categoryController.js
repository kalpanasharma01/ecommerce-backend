const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const data = await Category.find().sort('name');
  res.json({ success: true, count: data.length, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await Category.create(req.body);
  res.status(201).json({ success: true, data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) throw new AppError('Category not found', 404);
  res.json({ success: true, data });
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) throw new AppError('Category has products and cannot be deleted', 409);
  const data = await Category.findByIdAndDelete(req.params.id);
  if (!data) throw new AppError('Category not found', 404);
  res.json({ success: true, message: 'Category deleted' });
});
