const r = require('express').Router();
const c = require('../controllers/cartController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

r.use(protect, authorize('customer')); // carts belong to customers only; each user only ever touches their own
r.get('/', c.get);
r.post('/items', v(s.cartAdd), c.addItem);
r.patch('/items/:productId', v(s.productIdParam, 'params'), v(s.cartUpdate), c.updateItem);
r.delete('/items/:productId', v(s.productIdParam, 'params'), c.removeItem);
r.delete('/', c.clear);
module.exports = r;
