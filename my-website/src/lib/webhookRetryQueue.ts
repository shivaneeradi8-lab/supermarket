import WebhookJob from '@/models/WebhookJob';

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_LOCK_SECONDS = 120;
const DEFAULT_RETRY_DELAYS_SECONDS = [15, 60, 180, 600, 1800, 3600, 7200, 21600];

type Provider = 'stripe' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic';

type BeginWebhookJobInput = {
  provider: Provider;
  eventId: string;
  payload?: Record<string, unknown>;
};

type BeginWebhookJobResult =
  | { kind: 'claimed'; jobId: string; attempts: number }
  | { kind: 'duplicate_completed' }
  | { kind: 'in_progress' }
  | { kind: 'backoff'; retryAt: Date };

function getMaxAttempts() {
  const parsed = Number(process.env.WEBHOOK_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_ATTEMPTS;
}

function getLockMs() {
  const parsed = Number(process.env.WEBHOOK_LOCK_SECONDS || DEFAULT_LOCK_SECONDS);
  const seconds = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LOCK_SECONDS;
  return seconds * 1000;
}

function getRetryDelaysSeconds() {
  const raw = String(process.env.WEBHOOK_RETRY_DELAYS_SECONDS || '').trim();
  if (!raw) {
    return DEFAULT_RETRY_DELAYS_SECONDS;
  }

  const parsed = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v >= 0)
    .map((v) => Math.floor(v));

  return parsed.length > 0 ? parsed : DEFAULT_RETRY_DELAYS_SECONDS;
}

function computeRetryDelayMs(attempts: number) {
  const delays = getRetryDelaysSeconds();
  const idx = Math.max(0, Math.min(delays.length - 1, attempts - 1));
  return delays[idx] * 1000;
}

export async function beginWebhookJob(input: BeginWebhookJobInput): Promise<BeginWebhookJobResult> {
  const now = new Date();

  await WebhookJob.updateOne(
    { provider: input.provider, eventId: input.eventId },
    {
      $setOnInsert: {
        provider: input.provider,
        eventId: input.eventId,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        payload: input.payload || {},
      },
    },
    { upsert: true }
  );

  const existing = await WebhookJob.findOne({ provider: input.provider, eventId: input.eventId });
  if (!existing) {
    return { kind: 'in_progress' };
  }

  if (existing.status === 'completed') {
    return { kind: 'duplicate_completed' };
  }

  if (existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
    return { kind: 'in_progress' };
  }

  if (existing.nextAttemptAt && existing.nextAttemptAt.getTime() > now.getTime()) {
    return { kind: 'backoff', retryAt: existing.nextAttemptAt };
  }

  const claim = await WebhookJob.findOneAndUpdate(
    {
      _id: existing._id,
      status: { $in: ['pending', 'processing'] },
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lte: now } }],
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: 'processing',
        lockedUntil: new Date(now.getTime() + getLockMs()),
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  );

  if (!claim) {
    return { kind: 'in_progress' };
  }

  return { kind: 'claimed', jobId: String(claim._id), attempts: Number(claim.attempts) };
}

export async function completeWebhookJob(jobId: string) {
  await WebhookJob.findByIdAndUpdate(jobId, {
    $set: {
      status: 'completed',
      lockedUntil: undefined,
      lastError: undefined,
      lastProcessedAt: new Date(),
      nextAttemptAt: new Date(),
    },
  });
}

export async function failWebhookJob(jobId: string, error: unknown, attempts: number) {
  const now = Date.now();
  const maxAttempts = getMaxAttempts();
  const retryDelayMs = computeRetryDelayMs(attempts);
  const shouldDeadLetter = attempts >= maxAttempts;

  await WebhookJob.findByIdAndUpdate(jobId, {
    $set: {
      status: shouldDeadLetter ? 'dead_letter' : 'pending',
      lockedUntil: undefined,
      lastProcessedAt: new Date(),
      nextAttemptAt: new Date(now + retryDelayMs),
      lastError: error instanceof Error ? error.message : String(error),
    },
  });
}
