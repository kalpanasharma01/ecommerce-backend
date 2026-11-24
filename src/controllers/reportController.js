const Order = require('../models/Order');
const Product = require('../models/Product');
const { asyncHandler } = require('../utils/helpers');

const dateMatch = ({ from, to }) => {
  if (!from && !to) return {};
  const createdAt = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;
  return { createdAt };
};
// sellers see only their own figures, admins see everything
const sellerScope = (user) => (user.role === 'seller' ? [{ $match: { 'items.seller': user._id } }] : []);

/** AGGREGATION 1 - date-wise sales summary: $match -> $unwind -> $group -> $project -> $sort */
exports.salesSummary = asyncHandler(async (req, res) => {
  const data = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' }, ...dateMatch(req.query) } },
    { $unwind: '$items' },
    ...sellerScope(req.user),
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        unitsSold: { $sum: '$items.quantity' },
        orders: { $addToSet: '$_id' },
      },
    },
    { $project: { _id: 0, date: '$_id', revenue: { $round: ['$revenue', 2] }, unitsSold: 1, orderCount: { $size: '$orders' } } },
    { $sort: { date: 1 } },
  ]);
  const totals = data.reduce((t, d) => ({ revenue: t.revenue + d.revenue, unitsSold: t.unitsSold + d.unitsSold }), { revenue: 0, unitsSold: 0 });
  res.json({ success: true, totals: { revenue: Math.round(totals.revenue * 100) / 100, unitsSold: totals.unitsSold }, data });
});

/** AGGREGATION 2 - best-selling products: $group -> $sort -> $limit -> $lookup (current stock) */
exports.bestSelling = asyncHandler(async (req, res) => {
  const data = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' }, ...dateMatch(req.query) } },
    { $unwind: '$items' },
    ...sellerScope(req.user),
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: req.query.limit },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $project: { _id: 0, productId: '$_id', name: 1, unitsSold: 1, revenue: { $round: ['$revenue', 2] }, currentStock: { $first: '$product.stock' } } },
  ]);
  res.json({ success: true, data });
});

/** AGGREGATION 3 - inventory summary per category: $match -> $group -> $lookup -> $project */
exports.inventorySummary = asyncHandler(async (req, res) => {
  const match = { isActive: true };
  if (req.user.role === 'seller') match.seller = req.user._id;
  const data = await Product.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        products: { $sum: 1 },
        totalUnits: { $sum: '$stock' },
        stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
        outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $project: { _id: 0, category: { $first: '$cat.name' }, products: 1, totalUnits: 1, outOfStock: 1, stockValue: { $round: ['$stockValue', 2] } } },
    { $sort: { stockValue: -1 } },
  ]);
  res.json({ success: true, data });
});

/** Low-stock alerts: products whose stock is at or below their own threshold ($expr compares two fields) */
exports.lowStock = asyncHandler(async (req, res) => {
  const filter = { isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
  if (req.user.role === 'seller') filter.seller = req.user._id;
  const data = await Product.find(filter).select('name stock lowStockThreshold seller').sort('stock');
  res.json({ success: true, count: data.length, data });
});
