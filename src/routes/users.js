const r = require('express').Router();
const c = require('../controllers/userController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

r.use(protect);
r.get('/me', c.getMe);
r.patch('/me', v(s.profileUpdate), c.updateMe);

r.use(authorize('admin'));
r.get('/', c.listUsers);
r.get('/:id', v(s.idParam, 'params'), c.getUser);
r.patch('/:id', v(s.idParam, 'params'), v(s.adminUserUpdate), c.updateUser);
r.delete('/:id', v(s.idParam, 'params'), c.deleteUser);
module.exports = r;
