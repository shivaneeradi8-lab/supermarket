import PaymentEvent from '@/models/PaymentEvent';
import { logWarn } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

type RecordPaymentEventInput = {
  provider: 'stripe' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic';
  providerEventId: string;
  orderId?: string;
  eventType: string;
  outcome: 'success' | 'failure' | 'ignored';
  status?: string;
  reason?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
};

type FailureThresholdStatus = {
  threshold: number;
  windowSeconds: number;
  cooldownSeconds: number;
  failureCount: number;
  thresholdExceeded: boolean;
  windowStartedAt: Date;
  windowEndedAt: Date;
};

declare global {
  var __paymentAlertCooldownStore: Map<string, number> | undefined;
}

const getAlertCooldownStore = () => {
  if (!global.__paymentAlertCooldownStore) {
    global.__paymentAlertCooldownStore = new Map<string, number>();
  }

  return global.__paymentAlertCooldownStore;
};

const getThreshold = () => {
  const fallback = 10;
  const parsed = Number(process.env.ALERT_PAYMENT_FAILURE_THRESHOLD || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const getWindowSeconds = () => {
  const fallback = 300;
  const parsed = Number(process.env.ALERT_PAYMENT_FAILURE_WINDOW_SECONDS || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const getCooldownSeconds = () => {
  const fallback = 300;
  const parsed = Number(process.env.ALERT_PAYMENT_FAILURE_COOLDOWN_SECONDS || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export async function getRecentPaymentFailureStatus(): Promise<FailureThresholdStatus> {
  const threshold = getThreshold();
  const windowSeconds = getWindowSeconds();
  const cooldownSeconds = getCooldownSeconds();

  const windowEndedAt = new Date();
  const windowStartedAt = new Date(windowEndedAt.getTime() - windowSeconds * 1000);

  const failureCount = await PaymentEvent.countDocuments({
    outcome: 'failure',
    createdAt: { $gte: windowStartedAt, $lte: windowEndedAt },
  });

  return {
    threshold,
    windowSeconds,
    cooldownSeconds,
    failureCount,
    thresholdExceeded: failureCount >= threshold,
    windowStartedAt,
    windowEndedAt,
  };
}

export async function evaluatePaymentFailureAlert() {
  const status = await getRecentPaymentFailureStatus();
  if (!status.thresholdExceeded) {
    return status;
  }

  const cooldownStore = getAlertCooldownStore();
  const key = `payment-failure-threshold:${status.windowSeconds}:${status.threshold}`;
  const now = Date.now();
  const cooldownUntil = cooldownStore.get(key) || 0;

  if (cooldownUntil > now) {
    return status;
  }

  cooldownStore.set(key, now + status.cooldownSeconds * 1000);

  const alertMessage = `Payment failures crossed threshold (${status.failureCount} failures in ${status.windowSeconds}s; threshold ${status.threshold}).`;
  logWarn(alertMessage, {
    failureCount: status.failureCount,
    windowSeconds: status.windowSeconds,
    threshold: status.threshold,
  });

  if (String(process.env.SENTRY_DSN || '').trim()) {
    Sentry.captureMessage(alertMessage, 'warning');
  }

  return status;
}

export async function recordPaymentEvent(input: RecordPaymentEventInput) {
  let wasInserted = false;

  try {
    const upsertResult = await PaymentEvent.findOneAndUpdate(
      {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
      {
        $setOnInsert: {
          provider: input.provider,
          providerEventId: input.providerEventId,
          orderId: input.orderId,
          eventType: input.eventType,
          outcome: input.outcome,
          status: input.status,
          reason: input.reason,
          amount: input.amount,
          metadata: input.metadata || {},
        },
      },
      { upsert: true, new: false }
    );

    wasInserted = !upsertResult;
  } catch (error: unknown) {
    // Duplicate events are expected in webhook flows; do not throw.
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
      return;
    }

    logWarn('Failed to persist payment event', {
      provider: input.provider,
      providerEventId: input.providerEventId,
      error: error instanceof Error ? error.message : String(error),
    });

    return;
  }

  if (wasInserted && input.outcome === 'failure') {
    await evaluatePaymentFailureAlert();
  }
}
