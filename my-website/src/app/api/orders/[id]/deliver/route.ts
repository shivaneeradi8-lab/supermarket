import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Order from '@/models/Order';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import { internalErrorResponse } from '@/lib/apiResponses';

// PUT /api/orders/[id]/deliver  — mark an order as delivered (admin/seller only)
// Body: { collectCodPayment?: boolean }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = requireRoles(request, ['admin', 'seller']);
    if (response) return response;

    await connectToDatabase();

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { collectCodPayment?: boolean };
    const collectCodPayment = Boolean(body.collectCodPayment);

    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status === 'delivered') {
      return NextResponse.json(
        { success: true, message: 'Order is already marked as delivered', data: order }
      );
    }

    if (!['success', 'pending'].includes(order.status)) {
      return NextResponse.json(
        { success: false, message: `Cannot mark a ${order.status} order as delivered` },
        { status: 400 }
      );
    }

    // COD orders: mark paid when delivery collects cash
    const isCod = order.paymentMethod === 'cod';
    if (isCod && collectCodPayment && !order.isPaid) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentResult = {
        ...(order.paymentResult || {}),
        status: 'success',
        provider: 'cod',
        reason: 'collected_on_delivery',
        receivedAt: new Date(),
      };

      await upsertPaymentLifecycle({
        orderId: String(order._id),
        userId: String(order.user),
        method: 'cod',
        provider: 'cod',
        status: 'succeeded',
        amount: Number(order.totalPrice),
        currency: 'INR',
        paidAt: order.paidAt,
        metadata: { source: 'order.deliver.cod', markedBy: user!.userId },
      });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.pendingExpiresAt = undefined;
    await order.save();

    return NextResponse.json({
      success: true,
      message: 'Order marked as delivered',
      data: order,
    });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to mark order as delivered');
  }
}
