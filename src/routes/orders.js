const r = require('express').Router();
const c = require('../controllers/orderController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

r.use(protect);
r.post('/', authorize('customer'), v(s.placeOrder), c.placeOrder);
r.get('/', v(s.orderQuery, 'query'), c.list);
r.get('/:id', v(s.idParam, 'params'), c.get);
r.patch('/:id/status', v(s.idParam, 'params'), v(s.orderStatus), c.updateStatus);
module.exports = r;
