import * as Sentry from '@sentry/nextjs';

let initialized = false;

function toSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }
  return fallback;
}

export async function register() {
  if (initialized) return;

  const dsn = String(process.env.SENTRY_DSN || '').trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: toSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  });

  initialized = true;
}
