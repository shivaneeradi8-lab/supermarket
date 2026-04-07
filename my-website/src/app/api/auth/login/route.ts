import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { getJwtSecret } from '@/lib/security';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { loginSchema } from '@/lib/validation';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();

    const parsedBody = loginSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const email = parsedBody.data.email.toLowerCase();
    const password = parsedBody.data.password;

    const rateLimit = consumeRateLimit(
      `auth:login:${getRequestIp(request)}:${email || 'unknown'}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many login attempts. Please try again later.', rateLimit);
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: 'Account is deactivated' },
        { status: 401 }
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    user.lastLogin = new Date();
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          lastLogin: user.lastLogin,
        },
        token,
      },
    });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to login');
  }
}