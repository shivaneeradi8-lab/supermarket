import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { requireRoles } from '@/lib/auth';
import PaymentEvent from '@/models/PaymentEvent';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse } from '@/lib/apiResponses';
import { getRecentPaymentFailureStatus } from '@/lib/paymentMonitoring';

const ADMIN_MONITOR_WINDOW_MS = 60 * 1000;
const ADMIN_MONITOR_LIMIT = 60;

const parsePositiveInt = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
};

export async function GET(request: NextRequest) {
  try {
    const { user, response } = requireRoles(request, ['admin']);
    if (response) return response;

    const rateLimit = consumeRateLimit(
      `admin:payments:failures:${getRequestIp(request)}:${user?.userId || 'unknown'}`,
      ADMIN_MONITOR_LIMIT,
      ADMIN_MONITOR_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many monitoring requests. Please retry later.', rateLimit);
    }

    await connectToDatabase();

    const params = request.nextUrl.searchParams;
    const minutes = parsePositiveInt(params.get('minutes'), 60, 24 * 60);
    const limit = parsePositiveInt(params.get('limit'), 50, 200);
    const provider = String(params.get('provider') || '').trim().toLowerCase();

    const since = new Date(Date.now() - minutes * 60 * 1000);
    const baseQuery: Record<string, unknown> = {
      outcome: 'failure',
      createdAt: { $gte: since },
    };

    if (provider) {
      baseQuery.provider = provider;
    }

    const [items, totalFailures, byProvider, byReason, thresholdStatus] = await Promise.all([
      PaymentEvent.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      PaymentEvent.countDocuments(baseQuery),
      PaymentEvent.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$provider', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      PaymentEvent.aggregate([
        { $match: baseQuery },
        { $group: { _id: { $ifNull: ['$reason', 'unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      getRecentPaymentFailureStatus(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        window: {
          minutes,
          since,
        },
        threshold: thresholdStatus,
        summary: {
          totalFailures,
          byProvider: byProvider.map((entry) => ({ provider: entry._id, count: entry.count })),
          byReason: byReason.map((entry) => ({ reason: entry._id, count: entry.count })),
        },
        items,
      },
    });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to load payment failures');
  }
}
