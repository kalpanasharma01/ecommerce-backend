const r = require('express').Router();
const c = require('../controllers/reportController');
const v = require('../middleware/validate');
const s = require('../validators/schemas');
const { protect, authorize } = require('../middleware/auth');

r.use(protect, authorize('seller', 'admin'));
r.get('/sales-summary', v(s.reportQuery, 'query'), c.salesSummary);
r.get('/best-selling', v(s.reportQuery, 'query'), c.bestSelling);
r.get('/inventory-summary', c.inventorySummary);
r.get('/low-stock', c.lowStock);
module.exports = r;
