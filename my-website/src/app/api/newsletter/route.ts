import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { newsletterSchema } from '@/lib/validation';

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 3;

// POST /api/newsletter
export async function POST(request: NextRequest) {
  try {
    const rateLimit = consumeRateLimit(
      `newsletter:subscribe:${getRequestIp(request)}`,
      LIMIT,
      WINDOW_MS
    );
    if (rateLimit.limited) {
      return createRateLimitResponse('Too many subscription attempts. Please try again later.', rateLimit);
    }

    const parsedBody = newsletterSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const { email } = parsedBody.data;

    await connectToDatabase();

    const existing = await NewsletterSubscriber.findOne({ email });
    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { success: true, message: 'You are already subscribed!' },
        );
      }
      existing.isActive = true;
      await existing.save();
      return NextResponse.json({ success: true, message: 'Welcome back! You have been re-subscribed.' });
    }

    await NewsletterSubscriber.create({ email });

    return NextResponse.json(
      { success: true, message: 'Successfully subscribed! Thank you.' },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json({ success: true, message: 'You are already subscribed!' });
    }
    return internalErrorResponse(error, 'Failed to subscribe');
  }
}
