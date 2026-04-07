import { NextRequest, NextResponse } from 'next/server';
import { getAblyClient } from '@/lib/ably';
import { verifyToken } from '@/lib/auth';

// POST /api/realtime/token - Create Ably token request for authenticated clients
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const ably = getAblyClient();
    if (!ably) {
      return NextResponse.json(
        { success: false, message: 'Real-time service is not configured' },
        { status: 503 }
      );
    }

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: String(user.userId),
    });

    return NextResponse.json({
      success: true,
      data: tokenRequest
    });

  } catch (error) {
    console.error('Error generating real-time token:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate real-time token' },
      { status: 500 }
    );
  }
}