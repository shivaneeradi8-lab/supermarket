import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/security';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { registerSchema } from '@/lib/validation';

const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_LIMIT = 5;

export async function POST(request: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();

    const parsedBody = registerSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const { name, email, password, phone, address } = parsedBody.data;

    const rateLimit = consumeRateLimit(
      `auth:register:${getRequestIp(request)}:${email.toLowerCase()}`,
      REGISTER_LIMIT,
      REGISTER_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many registration attempts. Please try again later.', rateLimit);
    }

    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      address
    });

    const savedUser = await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email, role: savedUser.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Update last login
    savedUser.lastLogin = new Date();
    await savedUser.save();

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: savedUser._id,
          name: savedUser.name,
          email: savedUser.email,
          role: savedUser.role,
          phone: savedUser.phone,
          address: savedUser.address
        },
        token
      }
    }, { status: 201 });

  } catch (error) {
    return internalErrorResponse(error, 'Failed to register user');
  }
}