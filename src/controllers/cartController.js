const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError, asyncHandler, round2 } = require('../utils/helpers');

// Totals are always computed on the server from live product prices
async function cartView(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product', 'name price stock isActive');
  const items = (cart?.items || [])
    .filter((i) => i.product)
    .map((i) => ({
      product: i.product._id,
      name: i.product.name,
      unitPrice: i.product.price,
      quantity: i.quantity,
      available: i.product.isActive && i.product.stock >= i.quantity,
      lineTotal: round2(i.product.price * i.quantity),
    }));
  return { items, totalAmount: round2(items.reduce((s, i) => s + i.lineTotal, 0)) };
}

exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await cartView(req.user._id) }));

exports.addItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError('Product not found', 404);
  const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((i) => i.product.equals(productId));
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > product.stock) throw new AppError(`Only ${product.stock} unit(s) of "${product.name}" available`, 409);
  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, quantity });
  await cart.save();
  res.status(201).json({ success: true, data: await cartView(req.user._id) });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart?.items.find((i) => i.product.equals(req.params.productId));
  if (!item) throw new AppError('Item not in cart', 404);
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new AppError('Product no longer available', 404);
  if (req.body.quantity > product.stock) throw new AppError(`Only ${product.stock} unit(s) available`, 409);
  item.quantity = req.body.quantity;
  await cart.save();
  res.json({ success: true, data: await cartView(req.user._id) });
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || !cart.items.some((i) => i.product.equals(req.params.productId))) throw new AppError('Item not in cart', 404);
  cart.items = cart.items.filter((i) => !i.product.equals(req.params.productId));
  await cart.save();
  res.json({ success: true, data: await cartView(req.user._id) });
});

exports.clear = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json({ success: true, message: 'Cart cleared' });
});
