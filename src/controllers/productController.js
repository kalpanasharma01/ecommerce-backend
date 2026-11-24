const Product = require('../models/Product');
const Category = require('../models/Category');
const events = require('../config/events');
const { AppError, asyncHandler } = require('../utils/helpers');

// Business rule: a seller may only modify their own products (admin may modify any)
const assertCanManage = (user, product) => {
  if (user.role !== 'admin' && !product.seller.equals(user._id)) {
    throw new AppError('You can only modify your own products', 403);
  }
};

const loadProduct = async (id) => {
  const p = await Product.findById(id);
  if (!p) throw new AppError('Product not found', 404);
  return p;
};

exports.create = asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) throw new AppError('Category does not exist', 404);
  const product = await Product.create({ ...req.body, seller: req.user._id });
  res.status(201).json({ success: true, data: product });
});

// Search, filter, sort and paginate
exports.list = asyncHandler(async (req, res) => {
  const { q, category, seller, minPrice, maxPrice, inStock, sort, page, limit } = req.query;
  const filter = { isActive: true };
  if (q) filter.$text = { $search: q };
  if (category) filter.category = category;
  if (seller) filter.seller = seller;
  if (inStock) filter.stock = { $gt: 0 };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  const [data, total] = await Promise.all([
    Product.find(filter).populate('category', 'name').populate('seller', 'name').sort(sort.replace(',', ' ')).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, pages: Math.ceil(total / limit), data });
});

exports.get = asyncHandler(async (req, res) => {
  const p = await Product.findOne({ _id: req.params.id, isActive: true }).populate('category', 'name').populate('seller', 'name');
  if (!p) throw new AppError('Product not found', 404);
  res.json({ success: true, data: p });
});

exports.update = asyncHandler(async (req, res) => {
  const product = await loadProduct(req.params.id);
  assertCanManage(req.user, product);
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) throw new AppError('Category does not exist', 404);
  Object.assign(product, req.body);
  await product.save();
  res.json({ success: true, data: product });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const product = await loadProduct(req.params.id);
  assertCanManage(req.user, product);
  product.stock = req.body.stock;
  await product.save();
  if (product.stock <= product.lowStockThreshold) events.emit('stock.low', { product });
  res.json({ success: true, data: product });
});

// Soft delete so historical orders keep a valid reference
exports.remove = asyncHandler(async (req, res) => {
  const product = await loadProduct(req.params.id);
  assertCanManage(req.user, product);
  product.isActive = false;
  await product.save();
  res.json({ success: true, message: 'Product removed from catalogue' });
});
