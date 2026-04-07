import { NextRequest, NextResponse } from 'next/server';
import { type ClientSession } from 'mongoose';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import connectToDatabase from '@/lib/mongodb';
import { hardConfirmReservation, restoreOrderStock, withMongoTransaction } from '@/lib/orderLifecycle';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import Order from '@/models/Order';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse } from '@/lib/apiResponses';
import { recordPaymentEvent } from '@/lib/paymentMonitoring';
import { logInfo, logWarn } from '@/lib/logger';
import { requireStripeSecretKey, requireStripeWebhookSecret } from '@/lib/launchReadiness';
import { beginWebhookJob, completeWebhookJob, failWebhookJob } from '@/lib/webhookRetryQueue';

const STRIPE_WEBHOOK_WINDOW_MS = 60 * 1000;
const STRIPE_WEBHOOK_LIMIT = 300;
const STRIPE_EXPECTED_CURRENCY = 'inr';

function getStripeWebhookConfig() {
  let stripeSecretKey = '';
  let endpointSecret = '';

  try {
    stripeSecretKey = requireStripeSecretKey();
    endpointSecret = requireStripeWebhookSecret();
  } catch {
    return null;
  }

  return {
    stripe: new Stripe(stripeSecretKey),
    endpointSecret,
  };
}

function getOrderExpectedStripeAmount(order: { totalPrice: number }) {
  return Math.round(Number(order.totalPrice) * 100);
}

function validateStripePaymentIntentForOrder(
  paymentIntent: Stripe.PaymentIntent,
  order: { totalPrice: number; paymentMethod: string }
) {
  if (order.paymentMethod !== 'stripe') {
    return 'order_not_stripe';
  }

  if ((paymentIntent.currency || '').toLowerCase() !== STRIPE_EXPECTED_CURRENCY) {
    return 'currency_mismatch';
  }

  if (Number(paymentIntent.amount) !== getOrderExpectedStripeAmount(order)) {
    return 'amount_mismatch';
  }

  if (process.env.NODE_ENV === 'production' && paymentIntent.livemode !== true) {
    return 'non_live_payment_intent';
  }

  return null;
}

async function loadOrderForUpdate(orderId: string, session: ClientSession) {
  return Order.findById(orderId).session(session);
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = consumeRateLimit(
      `webhook:stripe:${getRequestIp(request)}`,
      STRIPE_WEBHOOK_LIMIT,
      STRIPE_WEBHOOK_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many webhook requests. Please retry later.', rateLimit);
    }

    const stripeConfig = getStripeWebhookConfig();
    if (!stripeConfig) {
      return NextResponse.json(
        { success: false, message: 'Stripe webhook is not configured' },
        { status: 503 }
      );
    }

    const body = await request.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { success: false, message: 'Missing Stripe signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripeConfig.stripe.webhooks.constructEvent(body, sig, stripeConfig.endpointSecret);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'unknown';
      logWarn('Stripe webhook signature verification failed', { reason });
      return NextResponse.json(
        { success: false, message: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const claim = await beginWebhookJob({
      provider: 'stripe',
      eventId: event.id,
      payload: {
        eventType: event.type,
      },
    });

    if (claim.kind === 'duplicate_completed') {
      return NextResponse.json({ success: true, received: true, duplicate: true });
    }

    if (claim.kind === 'in_progress') {
      return NextResponse.json({ success: true, received: true, processing: true });
    }

    if (claim.kind === 'backoff') {
      return NextResponse.json({
        success: true,
        received: true,
        queued: true,
        retryAt: claim.retryAt.toISOString(),
      });
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          const outcome = await withMongoTransaction(async (session) => {
            const order = await loadOrderForUpdate(orderId, session);
            if (!order) {
              return { kind: 'missing' } as const;
            }

            if (order.paymentResult?.webhookEventId === event.id) {
              return { kind: 'duplicate' } as const;
            }

            const validationFailure = validateStripePaymentIntentForOrder(paymentIntent, order);
            if (validationFailure) {
              return { kind: 'invalid', reason: validationFailure } as const;
            }

            if (order.isPaid) {
              return { kind: 'already-paid' } as const;
            }

            if (order.status !== 'pending') {
              return {
                kind: 'state-conflict',
                status: order.status,
                reason: order.paymentResult?.reason,
              } as const;
            }

            await hardConfirmReservation(order, { session });
            order.isPaid = true;
            order.paidAt = new Date();
            order.status = 'success';

            order.paymentResult = {
              ...(order.paymentResult || {}),
              id: paymentIntent.id,
              status: paymentIntent.status,
              email_address: paymentIntent.receipt_email,
              provider: 'stripe',
              webhookEventId: event.id,
              receivedAt: new Date()
            };
            await order.save({ session });

            await upsertPaymentLifecycle({
              orderId,
              userId: String(order.user),
              method: 'stripe',
              provider: 'stripe',
              status: 'succeeded',
              amount: Number(order.totalPrice),
              currency: String(paymentIntent.currency || 'inr').toUpperCase(),
              providerPaymentId: paymentIntent.id,
              providerEventId: event.id,
              paidAt: order.paidAt || new Date(),
              metadata: {
                source: 'stripe.webhook',
                eventType: event.type,
              },
              session,
            });

            return { kind: 'processed' } as const;
          });

          if (outcome.kind === 'duplicate') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId,
              eventType: event.type,
              outcome: 'ignored',
              status: 'duplicate',
              reason: 'duplicate_webhook_event',
              amount: paymentIntent.amount ? Number(paymentIntent.amount) / 100 : undefined,
            });
            await completeWebhookJob(claim.jobId);
            return NextResponse.json({ success: true, received: true, duplicate: true });
          }

          if (outcome.kind === 'invalid') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId,
              eventType: event.type,
              outcome: 'failure',
              status: paymentIntent.status,
              reason: outcome.reason,
              amount: paymentIntent.amount ? Number(paymentIntent.amount) / 100 : undefined,
              metadata: {
                paymentIntentId: paymentIntent.id,
                currency: paymentIntent.currency,
                livemode: paymentIntent.livemode,
              },
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json(
              { success: false, message: 'Payment intent does not match server-side order state' },
              { status: 400 }
            );
          }

          if (outcome.kind === 'already-paid') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId,
              eventType: event.type,
              outcome: 'ignored',
              status: paymentIntent.status,
              reason: 'order_already_paid',
              amount: paymentIntent.amount ? Number(paymentIntent.amount) / 100 : undefined,
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json({
              success: true,
              received: true,
              ignored: true,
              message: 'Ignoring success callback for an already paid order'
            });
          }

          if (outcome.kind === 'state-conflict') {
            const conflictReason = outcome.reason === 'expired'
              ? 'order_not_pending_expired'
              : 'order_not_pending';

            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId,
              eventType: event.type,
              outcome: 'ignored',
              status: paymentIntent.status,
              reason: conflictReason,
              amount: paymentIntent.amount ? Number(paymentIntent.amount) / 100 : undefined,
              metadata: {
                orderStatus: outcome.status,
                orderReason: outcome.reason,
              },
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json({
              success: true,
              received: true,
              ignored: true,
              message: 'Ignoring success callback because order is no longer pending'
            });
          }

          await recordPaymentEvent({
            provider: 'stripe',
            providerEventId: event.id,
            orderId,
            eventType: event.type,
            outcome: 'success',
            status: paymentIntent.status,
            amount: paymentIntent.amount ? Number(paymentIntent.amount) / 100 : undefined,
            metadata: {
              paymentIntentId: paymentIntent.id,
            },
          });

          logInfo('Stripe payment marked as paid', { orderId, eventId: event.id, paymentIntentId: paymentIntent.id });
        }
          break;

        case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        const failedOrderId = failedPaymentIntent.metadata.orderId;

        if (failedOrderId) {
          const outcome = await withMongoTransaction(async (session) => {
            const order = await loadOrderForUpdate(failedOrderId, session);
            if (!order) {
              return { kind: 'missing' } as const;
            }

            if (order.paymentResult?.webhookEventId === event.id) {
              return { kind: 'duplicate' } as const;
            }

            const validationFailure = validateStripePaymentIntentForOrder(failedPaymentIntent, order);
            if (validationFailure) {
              return { kind: 'invalid', reason: validationFailure } as const;
            }

            if (order.isPaid) {
              return { kind: 'already-paid' } as const;
            }

            if (order.status === 'cancelled') {
              return { kind: 'already-cancelled', reason: order.paymentResult?.reason } as const;
            }

            if (order.status !== 'pending') {
              return {
                kind: 'state-conflict',
                status: order.status,
                reason: order.paymentResult?.reason,
              } as const;
            }

            await restoreOrderStock(order, { session });
            order.status = 'cancelled';

            order.paymentResult = {
              ...(order.paymentResult || {}),
              id: failedPaymentIntent.id,
              status: 'cancelled',
              provider: 'stripe',
              reason: 'payment_failed',
              webhookEventId: event.id,
              receivedAt: new Date(),
            };
            await order.save({ session });

            await upsertPaymentLifecycle({
              orderId: failedOrderId,
              userId: String(order.user),
              method: 'stripe',
              provider: 'stripe',
              status: 'failed',
              amount: Number(order.totalPrice),
              currency: String(failedPaymentIntent.currency || 'inr').toUpperCase(),
              providerPaymentId: failedPaymentIntent.id,
              providerEventId: event.id,
              failureReason: 'payment_failed',
              cancelledAt: new Date(),
              metadata: {
                source: 'stripe.webhook',
                eventType: event.type,
              },
              session,
            });

            return { kind: 'processed' } as const;
          });

          if (outcome.kind === 'duplicate') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId: failedOrderId,
              eventType: event.type,
              outcome: 'ignored',
              status: 'duplicate',
              reason: 'duplicate_webhook_event',
              amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
            });
            await completeWebhookJob(claim.jobId);
            return NextResponse.json({ success: true, received: true, duplicate: true });
          }

          if (outcome.kind === 'invalid') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId: failedOrderId,
              eventType: event.type,
              outcome: 'failure',
              status: failedPaymentIntent.status,
              reason: outcome.reason,
              amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
              metadata: {
                paymentIntentId: failedPaymentIntent.id,
                currency: failedPaymentIntent.currency,
                livemode: failedPaymentIntent.livemode,
              },
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json(
              { success: false, message: 'Failed payment intent does not match server-side order state' },
              { status: 400 }
            );
          }

          if (outcome.kind === 'already-paid') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId: failedOrderId,
              eventType: event.type,
              outcome: 'ignored',
              status: failedPaymentIntent.status,
              reason: 'order_already_paid',
              amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
            });
            await completeWebhookJob(claim.jobId);
            return NextResponse.json({
              success: true,
              received: true,
              ignored: true,
              message: 'Ignoring failed callback for an already paid order'
            });
          }

          if (outcome.kind === 'already-cancelled') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId: failedOrderId,
              eventType: event.type,
              outcome: 'ignored',
              status: failedPaymentIntent.status,
              reason: outcome.reason === 'expired' ? 'order_already_expired' : 'order_already_cancelled',
              amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json({
              success: true,
              received: true,
              ignored: true,
              message: 'Ignoring failed callback for an already cancelled order'
            });
          }

          if (outcome.kind === 'state-conflict') {
            await recordPaymentEvent({
              provider: 'stripe',
              providerEventId: event.id,
              orderId: failedOrderId,
              eventType: event.type,
              outcome: 'ignored',
              status: failedPaymentIntent.status,
              reason: 'order_not_pending',
              amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
              metadata: {
                orderStatus: outcome.status,
                orderReason: outcome.reason,
              },
            });

            await completeWebhookJob(claim.jobId);
            return NextResponse.json({
              success: true,
              received: true,
              ignored: true,
              message: 'Ignoring failed callback because order is no longer pending'
            });
          }

          await recordPaymentEvent({
            provider: 'stripe',
            providerEventId: event.id,
            orderId: failedOrderId,
            eventType: event.type,
            outcome: 'failure',
            status: failedPaymentIntent.status,
            reason: 'payment_failed',
            amount: failedPaymentIntent.amount ? Number(failedPaymentIntent.amount) / 100 : undefined,
            metadata: {
              paymentIntentId: failedPaymentIntent.id,
            },
          });

          logWarn('Stripe payment marked as failed', {
            orderId: failedOrderId,
            eventId: event.id,
            paymentIntentId: failedPaymentIntent.id,
          });
        }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      await completeWebhookJob(claim.jobId);
    } catch (processingError) {
      await failWebhookJob(claim.jobId, processingError, claim.attempts);
      throw processingError;
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error) {
    return internalErrorResponse(error, 'Webhook processing failed');
  }
}