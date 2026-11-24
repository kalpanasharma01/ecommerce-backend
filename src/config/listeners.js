const events = require('./events');
const { emitTo } = require('./socket');

// order.placed -> notify customer, each involved seller and admins; check low stock
events.on('order.placed', ({ order, lowStock }) => {
  console.log(`[event] order.placed ${order._id} total=${order.totalAmount}`);
  emitTo(`user:${order.customer}`, 'order:placed', { orderId: order._id, totalAmount: order.totalAmount, status: order.status });

  const sellers = [...new Set(order.items.map((i) => String(i.seller)))];
  sellers.forEach((s) => {
    const items = order.items.filter((i) => String(i.seller) === s).map((i) => ({ name: i.name, quantity: i.quantity }));
    emitTo(`user:${s}`, 'order:new', { orderId: order._id, items });
  });
  emitTo('role:admin', 'order:new', { orderId: order._id, totalAmount: order.totalAmount });

  (lowStock || []).forEach((product) => events.emit('stock.low', { product }));
});

// stock.low -> alert the owning seller and admins
events.on('stock.low', ({ product }) => {
  const payload = { productId: product._id, name: product.name, stock: product.stock, threshold: product.lowStockThreshold };
  console.log(`[event] stock.low ${product.name} stock=${product.stock}`);
  emitTo(`user:${product.seller}`, 'stock:low', payload);
  emitTo('role:admin', 'stock:low', payload);
});

// order.statusChanged -> notify the customer
events.on('order.statusChanged', ({ order }) => {
  console.log(`[event] order.statusChanged ${order._id} -> ${order.status}`);
  emitTo(`user:${order.customer}`, 'order:status', { orderId: order._id, status: order.status });
});
