const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },       // snapshot
        price: { type: Number, required: true },      // price snapshot at checkout
        quantity: { type: Number, required: true, min: 1 },
        seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      },
    ],
    shippingAddress: {
      fullName: String, phone: String, line1: String, city: String, state: String, postalCode: String, country: String,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    payment: {
      method: { type: String, default: 'SIMULATED' },
      status: { type: String, default: 'SIMULATED_PAID' },
      note: { type: String, default: 'Simulated payment - no real transaction took place' },
    },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
  },
  { timestamps: true }
);

// INDEXES
orderSchema.index({ customer: 1, createdAt: -1 });  // customer order history
orderSchema.index({ 'items.seller': 1, status: 1 }); // seller order queue
orderSchema.index({ status: 1, createdAt: -1 });     // admin filter + reports by date

module.exports = mongoose.model('Order', orderSchema);
