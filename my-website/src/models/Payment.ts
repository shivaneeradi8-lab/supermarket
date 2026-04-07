import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
      enum: ['stripe', 'paypal', 'cod', 'upi'],
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['stripe', 'paypal', 'cod', 'upi', 'phonepe', 'paytm', 'razorpay', 'generic'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      maxlength: 16,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    providerEventId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    lastEventAt: {
      type: Date,
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

PaymentSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ provider: 1, providerEventId: 1 }, { sparse: true });
PaymentSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
