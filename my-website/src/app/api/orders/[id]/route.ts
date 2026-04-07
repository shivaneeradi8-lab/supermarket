import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { expireOrderIfStale, restoreOrderStock, withMongoTransaction } from '@/lib/orderLifecycle';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import Order from '@/models/Order';
import { buildUserIpEndpointRateLimitKey, createRateLimitResponse, consumeRateLimit } from '@/lib/rateLimit';

const ORDER_DETAIL_READ_WINDOW_MS = 5 * 60 * 1000;
const ORDER_DETAIL_READ_LIMIT = 60;
const ORDER_UPDATE_WINDOW_MS = 10 * 60 * 1000;
const ORDER_UPDATE_LIMIT = 20;

// GET /api/orders/[id] - Fetch a single order for the authenticated user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        endpoint: 'orders:detail',
        userId: String(user.userId),
      }),
      ORDER_DETAIL_READ_LIMIT,
      ORDER_DETAIL_READ_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many order detail requests. Please try again later.', rateLimit);
    }

    await connectToDatabase();

    const { id } = await params;
    const order = await Order.findOne({
      _id: id,
      user: user.userId
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    await expireOrderIfStale(order);

    return NextResponse.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - Confirm or cancel a pending order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        endpoint: 'checkout:update-order',
        userId: String(user.userId),
      }),
      ORDER_UPDATE_LIMIT,
      ORDER_UPDATE_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many order update requests. Please try again later.', rateLimit);
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!['confirm', 'cancel'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'A valid order action is required' },
        { status: 400 }
      );
    }

    const order = await Order.findOne({
      _id: id,
      user: user.userId
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    await expireOrderIfStale(order);

    if (order.isPaid || order.status === 'success') {
      if (action === 'confirm') {
        return NextResponse.json({
          success: true,
          data: order,
          message: 'Order already confirmed'
        });
      }

      return NextResponse.json(
        { success: false, message: 'Paid orders cannot be cancelled from checkout' },
        { status: 409 }
      );
    }

    if (action === 'confirm') {
      return NextResponse.json(
        { success: false, message: 'Payment confirmation can only come from verified payment provider webhooks' },
        { status: 409 }
      );
    }

    const updatedOrder = await withMongoTransaction(async (session) => {
      const transactionalOrder = await Order.findOne({
        _id: id,
        user: user.userId
      }).session(session);

      if (!transactionalOrder) {
        throw new Error('Order not found during cancellation transaction');
      }

      if (transactionalOrder.status !== 'cancelled') {
        await restoreOrderStock(transactionalOrder, { session });
        transactionalOrder.status = 'cancelled';
      }

      transactionalOrder.paymentResult = {
        ...(transactionalOrder.paymentResult || {}),
        reason: 'cancelled_by_user',
        status: 'cancelled'
      };

      await upsertPaymentLifecycle({
        orderId: String(transactionalOrder._id),
        userId: String(transactionalOrder.user),
        method: transactionalOrder.paymentMethod,
        provider: (transactionalOrder.paymentResult?.provider || transactionalOrder.paymentMethod || 'generic') as 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic',
        status: 'cancelled',
        amount: Number(transactionalOrder.totalPrice),
        currency: 'INR',
        providerPaymentId: transactionalOrder.paymentResult?.id,
        failureReason: 'cancelled_by_user',
        cancelledAt: new Date(),
        metadata: {
          source: 'orders.update.cancel',
        },
        session,
      });

      return transactionalOrder.save({ session });
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Order cancelled and stock restored'
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update order' },
      { status: 500 }
    );
  }
}