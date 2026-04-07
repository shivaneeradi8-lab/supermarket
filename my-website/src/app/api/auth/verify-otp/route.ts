import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import OtpCode from '@/models/OtpCode';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { getJwtSecret, hashOtpCode } from '@/lib/security';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { verifyOtpSchema } from '@/lib/validation';
import { requireOtpProviderConfig } from '@/lib/launchReadiness';

const MAX_OTP_ATTEMPTS = 5;
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const OTP_VERIFY_LIMIT = 5;

const normalizePhone = (input: string) => String(input || '').replace(/[^\d+]/g, '');

export async function POST(request: NextRequest) {
  try {
    const otpConfig = requireOtpProviderConfig();
    const jwtSecret = getJwtSecret();

    const parsedBody = verifyOtpSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const phone = normalizePhone(parsedBody.data.phone);
    const otp = String(parsedBody.data.otp || '').trim();

    const rateLimit = consumeRateLimit(
      `auth:verify-otp:${getRequestIp(request)}:${phone || 'unknown'}`,
      OTP_VERIFY_LIMIT,
      OTP_VERIFY_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many OTP verification attempts. Please try again later.', rateLimit);
    }

    await connectToDatabase();

    if (otpConfig.provider === 'twilio-verify') {
      const verifyResponse = await fetch(
        `https://verify.twilio.com/v2/Services/${otpConfig.serviceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${otpConfig.accountSid}:${otpConfig.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            Code: otp,
          }),
          cache: 'no-store',
        }
      );

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        return NextResponse.json(
          { success: false, message: 'OTP verification failed at provider', details: errorText.slice(0, 300) },
          { status: 502 }
        );
      }

      const verifyPayload = await verifyResponse.json() as { status?: string };
      if (String(verifyPayload?.status || '').toLowerCase() !== 'approved') {
        return NextResponse.json(
          { success: false, message: 'Invalid OTP' },
          { status: 401 }
        );
      }

      const user = await User.findOne({ phone, isActive: true });
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'No active account found for this phone number' },
          { status: 404 }
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
    }

    if (otpConfig.provider !== 'sms') {
      return NextResponse.json(
        { success: false, message: 'Unsupported OTP provider for server-side verification.' },
        { status: 503 }
      );
    }

    const otpEntry = await OtpCode.findOne({ phone });
    if (!otpEntry) {
      return NextResponse.json(
        { success: false, message: 'OTP not found or expired. Please request a new one.' },
        { status: 400 }
      );
    }

    if (otpEntry.expiresAt.getTime() < Date.now()) {
      await OtpCode.deleteOne({ _id: otpEntry._id });
      return NextResponse.json(
        { success: false, message: 'OTP expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const expectedHash = hashOtpCode(phone, otp, jwtSecret);
    if (expectedHash !== otpEntry.codeHash) {
      otpEntry.attempts = Number(otpEntry.attempts || 0) + 1;
      if (otpEntry.attempts >= MAX_OTP_ATTEMPTS) {
        await OtpCode.deleteOne({ _id: otpEntry._id });
        return NextResponse.json(
          { success: false, message: 'Too many attempts. Please request a new OTP.' },
          { status: 429 }
        );
      }
      await otpEntry.save();
      return NextResponse.json(
        { success: false, message: 'Invalid OTP' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ phone, isActive: true });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'No active account found for this phone number' },
        { status: 404 }
      );
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    user.lastLogin = new Date();
    await user.save();
    await OtpCode.deleteOne({ _id: otpEntry._id });

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
    return internalErrorResponse(error, 'Failed to verify OTP');
  }
}
