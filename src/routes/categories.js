const r = require('express').Router();
const c = require('../controllers/categoryController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

r.get('/', c.list);
r.post('/', protect, authorize('admin'), v(s.category), c.create);
r.patch('/:id', protect, authorize('admin'), v(s.idParam, 'params'), v(s.categoryUpdate), c.update);
r.delete('/:id', protect, authorize('admin'), v(s.idParam, 'params'), c.remove);
module.exports = r;
