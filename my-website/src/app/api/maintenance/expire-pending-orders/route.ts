import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { expirePendingUpiOrders } from '@/lib/orderLifecycle';
import { logInfo, logWarn } from '@/lib/logger';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorizationHeader = request.headers.get('authorization');
  const bearerToken = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : null;

  const headerSecret = request.headers.get('x-cron-secret');

  return bearerToken === cronSecret || headerSecret === cronSecret;
}

// POST /api/maintenance/expire-pending-orders - Sweep expired pending UPI reservations
async function runSweep(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      logWarn('Pending-order sweep unauthorized', {
        path: request.nextUrl.pathname,
        method: request.method,
        hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
        hasCronSecretHeader: Boolean(request.headers.get('x-cron-secret')),
      });
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const expiredCount = await expirePendingUpiOrders();

    logInfo('Pending-order sweep executed', {
      path: request.nextUrl.pathname,
      method: request.method,
      expiredCount,
      userAgent: request.headers.get('user-agent') || 'unknown',
      cronSource: request.headers.get('x-vercel-cron') || undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        expiredCount,
        sweptAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logWarn('Pending-order sweep failed', {
      path: request.nextUrl.pathname,
      method: request.method,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, message: 'Failed to sweep pending orders' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runSweep(request);
}

export async function POST(request: NextRequest) {
  return runSweep(request);
}