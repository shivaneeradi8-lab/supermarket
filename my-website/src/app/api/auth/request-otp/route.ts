import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import OtpCode from '@/models/OtpCode';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { getJwtSecret, hashOtpCode } from '@/lib/security';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { requestOtpSchema } from '@/lib/validation';
import { requireOtpProviderConfig } from '@/lib/launchReadiness';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_REQUEST_LIMIT = 3;

const normalizePhone = (input: string) => String(input || '').replace(/[^\d+]/g, '');

const generateOtp = () => {
  const max = 10 ** OTP_LENGTH;
  const num = Math.floor(Math.random() * max);
  return String(num).padStart(OTP_LENGTH, '0');
};

export async function POST(request: NextRequest) {
  try {
    const otpConfig = requireOtpProviderConfig();
    const jwtSecret = getJwtSecret();
    const parsedBody = requestOtpSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }
    const phone = normalizePhone(parsedBody.data.phone);

    const rateLimit = consumeRateLimit(
      `auth:request-otp:${getRequestIp(request)}:${phone || 'unknown'}`,
      OTP_REQUEST_LIMIT,
      OTP_REQUEST_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many OTP requests. Please try again later.', rateLimit);
    }

    if (otpConfig.provider === 'twilio-verify') {
      await connectToDatabase();

      const user = await User.findOne({ phone, isActive: true }).lean();
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'No active account found for this phone number' },
          { status: 404 }
        );
      }

      const twilioResponse = await fetch(
        `https://verify.twilio.com/v2/Services/${otpConfig.serviceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${otpConfig.accountSid}:${otpConfig.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            Channel: 'sms',
          }),
          cache: 'no-store',
        }
      );

      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        return NextResponse.json(
          { success: false, message: 'Failed to deliver OTP', details: errorText.slice(0, 300) },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully'
      });
    }

    if (otpConfig.provider !== 'sms') {
      return NextResponse.json(
        { success: false, message: 'Unsupported OTP provider for server-side request.' },
        { status: 503 }
      );
    }

    const otp = generateOtp();
    const ttlMs = OTP_TTL_MINUTES * 60 * 1000;

    await connectToDatabase();

    const user = await User.findOne({ phone, isActive: true }).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'No active account found for this phone number' },
        { status: 404 }
      );
    }

    const codeHash = hashOtpCode(phone, otp, jwtSecret);
    const expiresAt = new Date(Date.now() + ttlMs);

    await OtpCode.findOneAndUpdate(
      { phone },
      { codeHash, expiresAt, attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, message: 'OTP generated for SMS provider.' });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to request OTP');
  }
}
