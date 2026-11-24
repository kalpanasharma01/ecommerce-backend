// Sample data so the evaluator can run and test immediately:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Cart = require('../src/models/Cart');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Category, Product, Order, Cart].map((m) => m.deleteMany({})));

  const mk = (name, email, password, role) => User.create({ name, email, password, role });
  const admin = await mk('Admin User', 'admin@shop.com', 'Admin@123', 'admin');
  const s1 = await mk('Tech Seller', 'seller1@shop.com', 'Seller@123', 'seller');
  const s2 = await mk('Fashion Seller', 'seller2@shop.com', 'Seller@123', 'seller');
  const c1 = await mk('Asha Customer', 'customer1@shop.com', 'Customer@123', 'customer');
  await mk('Ravi Customer', 'customer2@shop.com', 'Customer@123', 'customer');

  const [electronics, fashion, books] = await Category.create([
    { name: 'Electronics', description: 'Gadgets and devices' },
    { name: 'Fashion', description: 'Clothing and accessories' },
    { name: 'Books', description: 'Printed and digital books' },
  ]);

  const products = await Product.create([
    { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 799, category: electronics._id, seller: s1._id, stock: 50 },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard, blue switches', price: 3499, category: electronics._id, seller: s1._id, stock: 20 },
    { name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI', price: 1999, category: electronics._id, seller: s1._id, stock: 4, lowStockThreshold: 5 },
    { name: 'Bluetooth Speaker', description: 'Portable waterproof speaker', price: 2499, category: electronics._id, seller: s1._id, stock: 15 },
    { name: 'Cotton T-Shirt', description: 'Unisex round neck cotton t-shirt', price: 499, category: fashion._id, seller: s2._id, stock: 100 },
    { name: 'Denim Jacket', description: 'Classic blue denim jacket', price: 2799, category: fashion._id, seller: s2._id, stock: 12 },
    { name: 'Running Shoes', description: 'Lightweight running shoes', price: 3299, category: fashion._id, seller: s2._id, stock: 3, lowStockThreshold: 5 },
    { name: 'Node.js in Action', description: 'Guide to backend development with Node.js', price: 899, category: books._id, seller: s1._id, stock: 30 },
  ]);

  // one historical order so reports return data immediately
  const [mouse, , , , tshirt] = products;
  await Product.updateOne({ _id: mouse._id }, { $inc: { stock: -2 } });
  await Product.updateOne({ _id: tshirt._id }, { $inc: { stock: -3 } });
  await Order.create({
    customer: c1._id,
    items: [
      { product: mouse._id, name: mouse.name, price: mouse.price, quantity: 2, seller: s1._id },
      { product: tshirt._id, name: tshirt.name, price: tshirt.price, quantity: 3, seller: s2._id },
    ],
    shippingAddress: { fullName: 'Asha Customer', phone: '9876543210', line1: '12 MG Road', city: 'Palwal', state: 'Haryana', postalCode: '121102', country: 'India' },
    totalAmount: 799 * 2 + 499 * 3,
    status: 'delivered',
    statusHistory: [{ status: 'pending' }, { status: 'delivered' }],
  });

  console.log('Seed complete. Login credentials:');
  console.log('  admin      admin@shop.com      Admin@123');
  console.log('  seller     seller1@shop.com    Seller@123  (also seller2@shop.com)');
  console.log('  customer   customer1@shop.com  Customer@123 (also customer2@shop.com)');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
