const r = require('express').Router();
const c = require('../controllers/productController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

const manage = [protect, authorize('seller', 'admin')];
r.get('/', v(s.productQuery, 'query'), c.list);
r.get('/:id', v(s.idParam, 'params'), c.get);
r.post('/', ...manage, v(s.productCreate), c.create);
r.patch('/:id', ...manage, v(s.idParam, 'params'), v(s.productUpdate), c.update);
r.patch('/:id/stock', ...manage, v(s.idParam, 'params'), v(s.stockUpdate), c.updateStock);
r.delete('/:id', ...manage, v(s.idParam, 'params'), c.remove);
module.exports = r;
