const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    price: { type: Number, required: true, min: [0.01, 'Price must be greater than 0'] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// INDEXES
productSchema.index({ name: 'text', description: 'text' });   // 1. full-text search (GET /products?q=)
productSchema.index({ category: 1, price: 1 });                // 2. category filter + price sort/range
productSchema.index({ seller: 1, isActive: 1 });               // 3. seller's own listings / reports

module.exports = mongoose.model('Product', productSchema);
