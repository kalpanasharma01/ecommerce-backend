const Joi = require('joi');
const oid = Joi.string().hex().length(24);

exports.register = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).pattern(/[A-Za-z]/).pattern(/\d/).required()
    .messages({ 'string.pattern.base': 'Password must contain letters and digits' }),
  role: Joi.string().valid('customer', 'seller').default('customer'),
});
exports.login = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
exports.refresh = Joi.object({ refreshToken: Joi.string().required() });

exports.category = Joi.object({ name: Joi.string().max(60).required(), description: Joi.string().max(300).allow('') });
exports.categoryUpdate = Joi.object({ name: Joi.string().max(60), description: Joi.string().max(300).allow('') }).min(1);

const productFields = {
  name: Joi.string().max(120),
  description: Joi.string().max(2000).allow(''),
  price: Joi.number().positive().precision(2),
  category: oid,
  stock: Joi.number().integer().min(0),
  lowStockThreshold: Joi.number().integer().min(0),
};
exports.productCreate = Joi.object({ ...productFields, name: productFields.name.required(), price: productFields.price.required(), category: productFields.category.required(), stock: productFields.stock.required() });
exports.productUpdate = Joi.object({ ...productFields, isActive: Joi.boolean() }).min(1);
exports.stockUpdate = Joi.object({ stock: Joi.number().integer().min(0).required() });
exports.productQuery = Joi.object({
  q: Joi.string().max(100), category: oid, seller: oid,
  minPrice: Joi.number().min(0), maxPrice: Joi.number().min(0), inStock: Joi.boolean(),
  sort: Joi.string().valid('price', '-price', 'name', '-name', 'createdAt', '-createdAt').default('-createdAt'),
  page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(50).default(10),
});

exports.cartAdd = Joi.object({ productId: oid.required(), quantity: Joi.number().integer().min(1).max(100).default(1) });
exports.cartUpdate = Joi.object({ quantity: Joi.number().integer().min(1).max(100).required() });

exports.placeOrder = Joi.object({
  shippingAddress: Joi.object({
    fullName: Joi.string().required(), phone: Joi.string().pattern(/^[0-9+\-\s]{8,15}$/).required(),
    line1: Joi.string().required(), city: Joi.string().required(), state: Joi.string().required(),
    postalCode: Joi.string().required(), country: Joi.string().default('India'),
  }).required(),
});
exports.orderStatus = Joi.object({ status: Joi.string().valid('confirmed', 'shipped', 'delivered', 'cancelled').required() });
exports.orderQuery = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
  page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(50).default(10),
});

exports.profileUpdate = Joi.object({ name: Joi.string().min(2).max(60).required() });
exports.adminUserUpdate = Joi.object({ role: Joi.string().valid('customer', 'seller', 'admin'), isActive: Joi.boolean() }).min(1);
exports.reportQuery = Joi.object({ from: Joi.date().iso(), to: Joi.date().iso().min(Joi.ref('from')), limit: Joi.number().integer().min(1).max(50).default(5) });
exports.idParam = Joi.object({ id: oid.required() });
exports.productIdParam = Joi.object({ productId: oid.required() });
