import { NextRequest, NextResponse } from 'next/server';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

declare global {
  var __rateLimitStore: Map<string, RateLimitEntry> | undefined;
}

function getStore() {
  if (!global.__rateLimitStore) {
    global.__rateLimitStore = new Map<string, RateLimitEntry>();
  }

  return global.__rateLimitStore;
}

function cleanupExpiredEntries(now: number) {
  const store = getStore();

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function buildUserIpEndpointRateLimitKey(
  request: NextRequest,
  options: {
    endpoint: string;
    userId?: string;
    extra?: string;
  }
) {
  const endpoint = String(options.endpoint || request.nextUrl.pathname).trim();
  const ip = getRequestIp(request);
  const userPart = String(options.userId || 'anonymous').trim();
  const extraPart = options.extra ? `:${String(options.extra).trim()}` : '';

  return `${endpoint}:${request.method.toUpperCase()}:${ip}:${userPart}${extraPart}`;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const store = getStore();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });

    return {
      limited: false,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  entry.count += 1;
  store.set(key, entry);

  const remaining = Math.max(0, limit - entry.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  return {
    limited: entry.count > limit,
    limit,
    remaining,
    resetAt: entry.resetAt,
    retryAfterSeconds,
  };
}

export function createRateLimitResponse(message: string, result: RateLimitResult) {
  return NextResponse.json(
    { success: false, message },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}