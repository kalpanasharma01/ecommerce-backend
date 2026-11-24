const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const events = require('../config/events');
const { AppError, asyncHandler, round2 } = require('../utils/helpers');

// Business rule: valid order status transitions
const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const restoreStock = (items) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));

// A seller only sees their own line items of an order
const sellerView = (order, sellerId) => {
  const o = order.toObject();
  o.items = o.items.filter((i) => String(i.seller) === String(sellerId));
  o.sellerSubtotal = round2(o.items.reduce((s, i) => s + i.price * i.quantity, 0));
  return o;
};
const viewFor = (order, user) => (user.role === 'seller' ? sellerView(order, user._id) : order);

/**
 * PLACE ORDER
 * Stock is decremented with an ATOMIC conditional update per item:
 *   updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })
 * MongoDB applies the condition and decrement as one operation, so two customers
 * buying the last unit at the same time cannot both succeed and stock never goes
 * negative. If any item fails, already-reserved items are rolled back (compensation).
 * (Works on a standalone MongoDB; no replica set required.)
 */
exports.placeOrder = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

  const reserved = [];
  const orderItems = [];
  const lowStock = [];
  let order;
  try {
    for (const ci of cart.items) {
      const p = ci.product;
      if (!p || !p.isActive) throw new AppError('A product in your cart is no longer available', 409);
      const updated = await Product.findOneAndUpdate(
        { _id: p._id, isActive: true, stock: { $gte: ci.quantity } },
        { $inc: { stock: -ci.quantity } },
        { new: true }
      );
      if (!updated) throw new AppError(`Insufficient stock for "${p.name}"`, 409);
      reserved.push({ product: p._id, quantity: ci.quantity });
      // price is revalidated here: the snapshot is the current DB price, not client data
      orderItems.push({ product: p._id, name: updated.name, price: updated.price, quantity: ci.quantity, seller: updated.seller });
      if (updated.stock <= updated.lowStockThreshold) lowStock.push(updated);
    }
    const totalAmount = round2(orderItems.reduce((s, i) => s + i.price * i.quantity, 0));
    order = await Order.create({
      customer: req.user._id,
      items: orderItems,
      shippingAddress: req.body.shippingAddress,
      totalAmount,
      statusHistory: [{ status: 'pending', by: req.user._id }],
    });
  } catch (err) {
    await restoreStock(reserved); // roll back reservations
    throw err;
  }

  await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } });
  events.emit('order.placed', { order, lowStock });
  res.status(201).json({ success: true, data: order });
});

exports.list = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.user.role === 'seller') filter['items.seller'] = req.user._id;
  if (status) filter.status = status;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, page, limit, total, data: orders.map((o) => viewFor(o, req.user)) });
});

exports.get = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const { role, _id } = req.user;
  const allowed =
    role === 'admin' ||
    (role === 'customer' && order.customer.equals(_id)) ||
    (role === 'seller' && order.items.some((i) => i.seller.equals(_id)));
  if (!allowed) throw new AppError('You cannot access this order', 403);
  res.json({ success: true, data: viewFor(order, req.user) });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const { status } = req.body;
  const { role, _id } = req.user;

  if (role === 'customer') {
    if (!order.customer.equals(_id)) throw new AppError('You cannot modify another customer\'s order', 403);
    if (status !== 'cancelled') throw new AppError('Customers may only cancel their orders', 403);
  } else if (role === 'seller' && !order.items.some((i) => i.seller.equals(_id))) {
    throw new AppError('This order contains none of your products', 403);
  }
  if (!TRANSITIONS[order.status].includes(status)) {
    throw new AppError(`Invalid status change: ${order.status} -> ${status}`, 400);
  }

  // Conditional update guards against a double cancel restoring stock twice
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status }, $push: { statusHistory: { status, by: _id } } },
    { new: true }
  );
  if (!updated) throw new AppError('Order was modified concurrently, please retry', 409);
  if (status === 'cancelled') await restoreStock(updated.items); // restore stock on cancellation

  events.emit('order.statusChanged', { order: updated, by: req.user });
  res.json({ success: true, data: viewFor(updated, req.user) });
});
