import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { updateProfileSchema } from '@/lib/validation';

const READ_WINDOW_MS = 60 * 1000;
const READ_LIMIT = 30;
const WRITE_WINDOW_MS = 15 * 60 * 1000;
const WRITE_LIMIT = 10;

// GET /api/users/profile
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(
      `profile:get:${getRequestIp(request)}:${user.userId}`,
      READ_LIMIT,
      READ_WINDOW_MS
    );
    if (rateLimit.limited) {
      return createRateLimitResponse('Too many requests.', rateLimit);
    }

    await connectToDatabase();

    const dbUser = await User.findById(user.userId).select(
      'name email phone address role emailVerified createdAt lastLogin preferences'
    );

    if (!dbUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: dbUser });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to fetch profile');
  }
}

// PUT /api/users/profile
export async function PUT(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = consumeRateLimit(
      `profile:update:${getRequestIp(request)}:${user.userId}`,
      WRITE_LIMIT,
      WRITE_WINDOW_MS
    );
    if (rateLimit.limited) {
      return createRateLimitResponse('Too many profile update requests.', rateLimit);
    }

    const parsedBody = updateProfileSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    await connectToDatabase();

    const updates: Record<string, unknown> = {};
    if (parsedBody.data.name) updates.name = parsedBody.data.name;
    if (parsedBody.data.phone !== undefined) updates.phone = parsedBody.data.phone;
    if (parsedBody.data.address) updates.address = parsedBody.data.address;

    const updated = await User.findByIdAndUpdate(
      user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('name email phone address role');

    if (!updated) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, message: 'Profile updated' });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to update profile');
  }
}
