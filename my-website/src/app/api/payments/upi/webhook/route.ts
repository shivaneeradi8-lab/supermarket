import { type ClientSession } from 'mongoose';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { hardConfirmReservation, expireOrderIfStale, restoreOrderStock, withMongoTransaction } from '@/lib/orderLifecycle';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import { normalizeUpiWebhookPayload } from '@/lib/upiWebhookAdapters';
import { verifyProviderWebhookSignature } from '@/lib/upiWebhookVerification';
import Order from '@/models/Order';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse } from '@/lib/apiResponses';
import { recordPaymentEvent } from '@/lib/paymentMonitoring';
import { logInfo, logWarn } from '@/lib/logger';
import { beginWebhookJob, completeWebhookJob, failWebhookJob } from '@/lib/webhookRetryQueue';

const SUCCESS_STATUSES = new Set(['success', 'paid', 'captured', 'completed']);
const FAILURE_STATUSES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'expired']);
const KNOWN_PROVIDERS = new Set(['phonepe', 'paytm', 'razorpay', 'generic']);
const UPI_WEBHOOK_WINDOW_MS = 60 * 1000;
const UPI_WEBHOOK_LIMIT = 300;

function normalizeProvider(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function buildDeterministicUpiEventId(input: {
  provider: string;
  normalizedPayload: {
    orderId?: string;
    status?: string;
    amount?: number;
    transactionId?: string;
  };
  rawBody: string;
}) {
  if (input.normalizedPayload.transactionId) {
    return input.normalizedPayload.transactionId;
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update([
      input.provider,
      input.normalizedPayload.orderId || 'unknown-order',
      input.normalizedPayload.status || 'unknown-status',
      String(input.normalizedPayload.amount ?? ''),
      input.rawBody,
    ].join('|'))
    .digest('hex')
    .slice(0, 24);

  return `upi-${input.provider}-${fingerprint}`;
}

async function loadUpiOrderForUpdate(orderId: string, session: ClientSession) {
  return Order.findById(orderId).session(session);
}

// POST /api/payments/upi/webhook - Provider callback for verified UPI outcomes
export async function POST(request: NextRequest) {
  try {
    const rateLimit = consumeRateLimit(
      `webhook:upi:${getRequestIp(request)}`,
      UPI_WEBHOOK_LIMIT,
      UPI_WEBHOOK_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many webhook requests. Please retry later.', rateLimit);
    }

    const rawBody = await request.text();
    const providerHint = request.headers.get('x-upi-provider') || request.nextUrl.searchParams.get('provider') || undefined;
    let rawPayload: Record<string, unknown>;

    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          { success: false, message: 'Webhook payload must be a JSON object' },
          { status: 400 }
        );
      }
      rawPayload = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const normalizedPayload = normalizeUpiWebhookPayload(rawPayload, { providerHint });
    const normalizedHint = normalizeProvider(providerHint);
    const normalizedPayloadProvider = normalizeProvider(normalizedPayload.provider);

    if (normalizedHint && !KNOWN_PROVIDERS.has(normalizedHint)) {
      return NextResponse.json(
        { success: false, message: 'Unsupported UPI provider hint' },
        { status: 400 }
      );
    }

    if (
      normalizedHint &&
      normalizedPayloadProvider &&
      normalizedPayloadProvider !== normalizedHint
    ) {
      return NextResponse.json(
        { success: false, message: 'UPI provider hint does not match webhook payload provider' },
        { status: 400 }
      );
    }

    const provider = normalizedHint || normalizedPayloadProvider;
    const providerEventId = buildDeterministicUpiEventId({
      provider,
      normalizedPayload,
      rawBody,
    });

    if (!provider || !KNOWN_PROVIDERS.has(provider)) {
      await recordPaymentEvent({
        provider: 'generic',
        providerEventId,
        orderId: normalizedPayload.orderId || undefined,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedPayload.status,
        reason: 'unsupported_provider',
        amount: normalizedPayload.amount,
      });
      return NextResponse.json(
        { success: false, message: 'Unsupported UPI webhook provider' },
        { status: 400 }
      );
    }

    if (provider === 'generic' && !normalizedHint && !normalizedPayloadProvider) {
      await recordPaymentEvent({
        provider: 'generic',
        providerEventId,
        orderId: normalizedPayload.orderId || undefined,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedPayload.status,
        reason: 'missing_provider_identity',
        amount: normalizedPayload.amount,
      });
      return NextResponse.json(
        { success: false, message: 'UPI webhook provider identity is required' },
        { status: 400 }
      );
    }

    if (!verifyProviderWebhookSignature(rawBody, request.headers, provider)) {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId: normalizedPayload.orderId || undefined,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedPayload.status,
        reason: 'invalid_signature',
        amount: normalizedPayload.amount,
      });
      return NextResponse.json(
        { success: false, message: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload = normalizedPayload;
    const orderId = payload.orderId;
    const normalizedStatus = payload.status;

    if (!orderId || !normalizedStatus) {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        eventType: 'upi.webhook',
        outcome: 'failure',
        reason: 'payload_normalization_failed',
      });
      return NextResponse.json(
        { success: false, message: 'Unable to normalize orderId and status from webhook payload' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const claim = await beginWebhookJob({
      provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
      eventId: providerEventId,
      payload: {
        orderId,
        status: normalizedStatus,
      },
    });

    if (claim.kind === 'duplicate_completed') {
      return NextResponse.json({ success: true, duplicate: true, message: 'Duplicate webhook event ignored' });
    }

    if (claim.kind === 'in_progress') {
      return NextResponse.json({ success: true, processing: true, message: 'Webhook event is already being processed' });
    }

    if (claim.kind === 'backoff') {
      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Webhook event is queued for retry',
        retryAt: claim.retryAt.toISOString(),
      });
    }

    try {
      let order = await Order.findById(orderId);
      if (!order) {
        await recordPaymentEvent({
          provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
          providerEventId,
          orderId,
          eventType: 'upi.webhook',
          outcome: 'failure',
          status: normalizedStatus,
          reason: 'order_not_found',
          amount: normalizedPayload.amount,
        });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json(
          { success: false, message: 'Order not found' },
          { status: 404 }
        );
      }

      if (order.paymentMethod !== 'upi') {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedStatus,
        reason: 'order_not_upi',
        amount: normalizedPayload.amount,
      });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json(
          { success: false, message: 'Order is not a UPI order' },
          { status: 400 }
        );
      }

      await expireOrderIfStale(order);

      order = await Order.findById(orderId);
      if (!order) {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedStatus,
        reason: 'order_not_found_after_expiry_check',
        amount: normalizedPayload.amount,
      });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json(
          { success: false, message: 'Order not found after expiry check' },
          { status: 404 }
        );
      }

      if (order.status === 'cancelled' && order.paymentResult?.reason === 'expired') {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'ignored',
        status: normalizedStatus,
        reason: 'order_already_expired',
        amount: normalizedPayload.amount,
        metadata: SUCCESS_STATUSES.has(normalizedStatus)
          ? { requiresReconciliation: true }
          : undefined,
      });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json({
          success: true,
          message: 'Order already expired before webhook processing',
          data: order
        });
      }

      if (order.paymentResult?.webhookEventId === providerEventId) {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'ignored',
        status: normalizedStatus,
        reason: 'duplicate_webhook_event',
        amount: normalizedPayload.amount,
      });

        await completeWebhookJob(claim.jobId);
        return NextResponse.json({
          success: true,
          message: 'Duplicate webhook event ignored',
          data: order,
          duplicate: true,
        });
      }

      const webhookAmount = Number(payload.amount);
      if (Number.isFinite(webhookAmount) && Math.abs(Number(order.totalPrice) - webhookAmount) > 0.01) {
      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedStatus,
        reason: 'amount_mismatch',
        amount: webhookAmount,
        metadata: { expectedAmount: Number(order.totalPrice) },
      });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json(
          { success: false, message: 'Webhook amount does not match order total' },
          { status: 400 }
        );
      }

      if (SUCCESS_STATUSES.has(normalizedStatus)) {
      if (
        payload.transactionId &&
        order.paymentResult?.id === payload.transactionId &&
        order.paymentResult?.status === 'success'
      ) {
        await recordPaymentEvent({
          provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
          providerEventId,
          orderId,
          eventType: 'upi.webhook',
          outcome: 'ignored',
          status: normalizedStatus,
          reason: 'duplicate_success_callback',
          amount: normalizedPayload.amount,
        });
        await completeWebhookJob(claim.jobId);
        return NextResponse.json({
          success: true,
          message: 'Duplicate success callback ignored',
          data: order,
          duplicate: true
        });
      }

      try {
        await withMongoTransaction(async (session) => {
          const transactionalOrder = await loadUpiOrderForUpdate(orderId, session);
          if (!transactionalOrder) {
            throw new Error(`Order not found during transactional UPI success update: ${orderId}`);
          }

          if (payload.transactionId && transactionalOrder.paymentResult?.id === payload.transactionId && transactionalOrder.paymentResult?.status === 'success') {
            return;
          }

          if (transactionalOrder.paymentResult?.webhookEventId === providerEventId) {
            return;
          }

          if (transactionalOrder.isPaid) {
            return;
          }

          if (transactionalOrder.status !== 'pending') {
            throw new Error(`ORDER_STATE_CONFLICT:${transactionalOrder.status}:${transactionalOrder.paymentResult?.reason || ''}`);
          }

          await hardConfirmReservation(transactionalOrder, { session });
          transactionalOrder.isPaid = true;
          transactionalOrder.paidAt = new Date();

          transactionalOrder.status = 'success';
          transactionalOrder.paymentResult = {
            ...(transactionalOrder.paymentResult || {}),
            id: payload.transactionId || transactionalOrder.paymentResult?.id,
            email_address: payload.email || transactionalOrder.paymentResult?.email_address,
            provider: payload.provider || transactionalOrder.paymentResult?.provider || 'upi',
            status: 'success',
            reason: undefined,
            webhookEventId: providerEventId,
            receivedAt: new Date()
          };

          await upsertPaymentLifecycle({
            orderId,
            userId: String(transactionalOrder.user),
            method: 'upi',
            provider: (payload.provider || provider || 'upi') as 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic',
            status: 'succeeded',
            amount: Number(transactionalOrder.totalPrice),
            currency: 'INR',
            providerPaymentId: payload.transactionId || undefined,
            providerEventId,
            paidAt: transactionalOrder.paidAt || new Date(),
            metadata: {
              source: 'upi.webhook',
              status: normalizedStatus,
            },
            session,
          });

          await transactionalOrder.save({ session });
        });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ORDER_STATE_CONFLICT:')) {
          const [, orderStatus = 'unknown', orderReason = ''] = error.message.split(':');
          const conflictReason = orderReason === 'expired' ? 'order_not_pending_expired' : 'order_not_pending';

          await recordPaymentEvent({
            provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
            providerEventId,
            orderId,
            eventType: 'upi.webhook',
            outcome: 'ignored',
            status: normalizedStatus,
            reason: conflictReason,
            amount: normalizedPayload.amount,
            metadata: {
              orderStatus,
              orderReason: orderReason || undefined,
              transactionId: payload.transactionId,
            },
          });

          await completeWebhookJob(claim.jobId);
          return NextResponse.json({
            success: true,
            message: 'Ignoring success callback because order is no longer pending',
            ignored: true,
          });
        }

        throw error;
      }

      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'success',
        status: normalizedStatus,
        amount: normalizedPayload.amount,
        metadata: { transactionId: payload.transactionId },
      });

      logInfo('UPI payment recorded as success', { orderId, provider, providerEventId, transactionId: payload.transactionId });

        await completeWebhookJob(claim.jobId);
        return NextResponse.json({
          success: true,
          message: 'UPI payment recorded',
          data: order
        });
      }

      if (FAILURE_STATUSES.has(normalizedStatus)) {
      if (order.isPaid) {
        await recordPaymentEvent({
          provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
          providerEventId,
          orderId,
          eventType: 'upi.webhook',
          outcome: 'ignored',
          status: normalizedStatus,
          reason: 'order_already_paid',
          amount: normalizedPayload.amount,
        });
        return NextResponse.json({
          success: true,
          message: 'Ignoring failure callback for an already paid order',
          data: order,
          ignored: true
        });
      }

      if (
        payload.transactionId &&
        order.paymentResult?.id === payload.transactionId &&
        order.paymentResult?.status === 'cancelled'
      ) {
        await recordPaymentEvent({
          provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
          providerEventId,
          orderId,
          eventType: 'upi.webhook',
          outcome: 'ignored',
          status: normalizedStatus,
          reason: 'duplicate_failure_callback',
          amount: normalizedPayload.amount,
        });
        return NextResponse.json({
          success: true,
          message: 'Duplicate failure callback ignored',
          data: order,
          duplicate: true
        });
      }

      try {
        await withMongoTransaction(async (session) => {
          const transactionalOrder = await loadUpiOrderForUpdate(orderId, session);
          if (!transactionalOrder) {
            throw new Error(`Order not found during transactional UPI failure update: ${orderId}`);
          }

          if (transactionalOrder.isPaid) {
            return;
          }

          if (transactionalOrder.status === 'cancelled') {
            return;
          }

          if (transactionalOrder.paymentResult?.webhookEventId === providerEventId) {
            return;
          }

          if (transactionalOrder.status !== 'pending') {
            throw new Error(`ORDER_STATE_CONFLICT:${transactionalOrder.status}:${transactionalOrder.paymentResult?.reason || ''}`);
          }

          await restoreOrderStock(transactionalOrder, { session });
          transactionalOrder.status = 'cancelled';

          transactionalOrder.paymentResult = {
            ...(transactionalOrder.paymentResult || {}),
            id: payload.transactionId || transactionalOrder.paymentResult?.id,
            email_address: payload.email || transactionalOrder.paymentResult?.email_address,
            provider: payload.provider || transactionalOrder.paymentResult?.provider || 'upi',
            status: 'cancelled',
            reason: normalizedStatus === 'expired' ? 'expired' : 'payment_failed',
            webhookEventId: providerEventId,
            receivedAt: new Date()
          };

          await upsertPaymentLifecycle({
            orderId,
            userId: String(transactionalOrder.user),
            method: 'upi',
            provider: (payload.provider || provider || 'upi') as 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic',
            status: normalizedStatus === 'expired' ? 'expired' : 'failed',
            amount: Number(transactionalOrder.totalPrice),
            currency: 'INR',
            providerPaymentId: payload.transactionId || undefined,
            providerEventId,
            failureReason: normalizedStatus === 'expired' ? 'expired' : 'payment_failed',
            cancelledAt: new Date(),
            metadata: {
              source: 'upi.webhook',
              status: normalizedStatus,
            },
            session,
          });

          transactionalOrder.pendingExpiresAt = undefined;
          await transactionalOrder.save({ session });
        });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ORDER_STATE_CONFLICT:')) {
          const [, orderStatus = 'unknown', orderReason = ''] = error.message.split(':');

          await recordPaymentEvent({
            provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
            providerEventId,
            orderId,
            eventType: 'upi.webhook',
            outcome: 'ignored',
            status: normalizedStatus,
            reason: 'order_not_pending',
            amount: normalizedPayload.amount,
            metadata: {
              orderStatus,
              orderReason: orderReason || undefined,
              transactionId: payload.transactionId,
            },
          });

          await completeWebhookJob(claim.jobId);
          return NextResponse.json({
            success: true,
            message: 'Ignoring failure callback because order is no longer pending',
            ignored: true,
          });
        }

        throw error;
      }

      await recordPaymentEvent({
        provider: (provider as 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic'),
        providerEventId,
        orderId,
        eventType: 'upi.webhook',
        outcome: 'failure',
        status: normalizedStatus,
        reason: normalizedStatus === 'expired' ? 'expired' : 'payment_failed',
        amount: normalizedPayload.amount,
        metadata: { transactionId: payload.transactionId },
      });

      logWarn('UPI payment recorded as failure', {
        orderId,
        provider,
        providerEventId,
        transactionId: payload.transactionId,
        status: normalizedStatus,
      });

        await completeWebhookJob(claim.jobId);
        return NextResponse.json({
          success: true,
          message: 'UPI payment failure recorded',
          data: order
        });
      }

      await completeWebhookJob(claim.jobId);
      return NextResponse.json({
        success: true,
        message: 'Webhook accepted with no order state change'
      });
    } catch (processingError) {
      await failWebhookJob(claim.jobId, processingError, claim.attempts);
      throw processingError;
    }

  } catch (error) {
    return internalErrorResponse(error, 'UPI webhook processing failed');
  }
}