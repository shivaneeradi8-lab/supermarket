import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyToken } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { expireOrderIfStale } from '@/lib/orderLifecycle';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import Order from '@/models/Order';
import { buildUserIpEndpointRateLimitKey, createRateLimitResponse, consumeRateLimit } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { createPaymentIntentSchema } from '@/lib/validation';
import { requireStripeSecretKey } from '@/lib/launchReadiness';

const PAYMENT_INTENT_WINDOW_MS = 10 * 60 * 1000;
const PAYMENT_INTENT_LIMIT = 25;

function getStripeClient() {
  let stripeSecretKey = '';

  try {
    stripeSecretKey = requireStripeSecretKey();
  } catch {
    return null;
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia',
  });
}

// POST /api/payments/create-payment-intent - Create Stripe payment intent
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rateLimit = consumeRateLimit(
      buildUserIpEndpointRateLimitKey(request, {
        endpoint: 'checkout:create-payment-intent',
        userId: String(user.userId),
      }),
      PAYMENT_INTENT_LIMIT,
      PAYMENT_INTENT_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many payment attempts. Please try again later.', rateLimit);
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { success: false, message: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const parsedBody = createPaymentIntentSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    await connectToDatabase();

    const { orderId } = parsedBody.data;

    // Verify order exists and belongs to user
    const order = await Order.findOne({
      _id: orderId,
      user: user.userId,
      isPaid: false,
      status: 'pending'
    });

    if (order) {
      await expireOrderIfStale(order);
    }

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Pending order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: 'Order is no longer payable' },
        { status: 409 }
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(order.totalPrice) * 100), // Convert to cents
      currency: 'inr',
      metadata: {
        orderId: orderId
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    await Order.findByIdAndUpdate(orderId, {
      paymentResult: {
        ...(order.paymentResult || {}),
        id: paymentIntent.id,
        status: paymentIntent.status,
        provider: 'stripe'
      }
    });

    await upsertPaymentLifecycle({
      orderId,
      userId: String(user.userId),
      method: 'stripe',
      provider: 'stripe',
      status: paymentIntent.status === 'requires_action' ? 'requires_action' : 'pending',
      amount: Number(order.totalPrice),
      currency: 'INR',
      providerPaymentId: paymentIntent.id,
      metadata: {
        source: 'payments.intent',
        stripeStatus: paymentIntent.status,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.totalPrice
      }
    });

  } catch (error) {
    return internalErrorResponse(error, 'Failed to create payment intent');
  }
}