const r = require('express').Router();
const c = require('../controllers/authController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect } = require('../middleware/auth');

r.post('/register', v(s.register), c.register);
r.post('/login', v(s.login), c.login);
r.post('/refresh', v(s.refresh), c.refresh);
r.post('/logout', protect, c.logout);
module.exports = r;
