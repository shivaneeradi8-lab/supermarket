import mongoose from 'mongoose';

const PaymentEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['stripe', 'upi', 'phonepe', 'paytm', 'razorpay', 'generic'],
      index: true,
    },
    providerEventId: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    outcome: {
      type: String,
      required: true,
      enum: ['success', 'failure', 'ignored'],
      index: true,
    },
    status: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    amount: {
      type: Number,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

PaymentEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
PaymentEventSchema.index({ createdAt: -1 });

export default mongoose.models.PaymentEvent || mongoose.model('PaymentEvent', PaymentEventSchema);
