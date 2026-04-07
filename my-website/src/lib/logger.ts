import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const shouldCaptureToSentry = () => Boolean(String(process.env.SENTRY_DSN || '').trim());

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function logInfo(message: string, context: LogContext = {}) {
  emit('info', message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  emit('warn', message, context);
}

export function logError(message: string, context: LogContext = {}) {
  emit('error', message, context);
}

export function captureError(error: unknown, context: LogContext = {}) {
  if (shouldCaptureToSentry()) {
    Sentry.captureException(error, { extra: context });
  }

  logError('Unhandled error', {
    ...context,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
}
