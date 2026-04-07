import { type ClientSession } from 'mongoose';
import Payment from '@/models/Payment';

type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'expired';

type UpsertPaymentLifecycleInput = {
  orderId: string;
  userId: string;
  method: 'stripe' | 'paypal' | 'cod' | 'upi';
  provider: 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic';
  status: PaymentStatus;
  amount: number;
  currency?: string;
  providerPaymentId?: string;
  providerEventId?: string;
  failureReason?: string;
  expiresAt?: Date;
  paidAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
};

export async function upsertPaymentLifecycle(input: UpsertPaymentLifecycleInput) {
  const update: Record<string, unknown> = {
    user: input.userId,
    method: input.method,
    provider: input.provider,
    status: input.status,
    amount: Number(input.amount),
    currency: String(input.currency || 'INR').toUpperCase(),
    lastEventAt: new Date(),
    metadata: input.metadata || {},
  };

  if (input.providerPaymentId) {
    update.providerPaymentId = input.providerPaymentId;
  }

  if (input.providerEventId) {
    update.providerEventId = input.providerEventId;
  }

  if (typeof input.failureReason === 'string') {
    update.failureReason = input.failureReason;
  }

  if (input.expiresAt) {
    update.expiresAt = input.expiresAt;
  }

  if (input.paidAt) {
    update.paidAt = input.paidAt;
  }

  if (input.cancelledAt) {
    update.cancelledAt = input.cancelledAt;
  }

  if (input.status === 'succeeded') {
    update.paidAt = input.paidAt || new Date();
    update.failureReason = undefined;
    update.cancelledAt = undefined;
  }

  if (input.status === 'failed' || input.status === 'cancelled' || input.status === 'expired') {
    update.cancelledAt = input.cancelledAt || new Date();
  }

  return Payment.findOneAndUpdate(
    { order: input.orderId },
    {
      $set: update,
      $setOnInsert: {
        order: input.orderId,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      ...(input.session ? { session: input.session } : {}),
    }
  );
}
