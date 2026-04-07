import mongoose from 'mongoose';

const WebhookJobSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['stripe', 'upi', 'phonepe', 'paytm', 'razorpay', 'generic'],
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'dead_letter'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lockedUntil: {
      type: Date,
      index: true,
    },
    lastError: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    lastProcessedAt: {
      type: Date,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

WebhookJobSchema.index({ provider: 1, eventId: 1 }, { unique: true });
WebhookJobSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.models.WebhookJob || mongoose.model('WebhookJob', WebhookJobSchema);
