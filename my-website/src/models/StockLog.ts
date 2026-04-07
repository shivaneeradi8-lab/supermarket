import mongoose from 'mongoose';

const StockLogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['add', 'sale', 'reserve', 'release'], required: true },
  quantity: { type: Number, required: true },
  beforeStock: { type: Number, min: 0 },
  afterStock: { type: Number, min: 0 },
  source: { type: String, enum: ['manual', 'order', 'system'], default: 'system' },
  date: { type: Date, default: Date.now },
  note: { type: String }
});

StockLogSchema.index({ date: -1, type: 1 });
StockLogSchema.index({ productId: 1, date: -1 });

export default mongoose.models.StockLog || mongoose.model('StockLog', StockLogSchema);
