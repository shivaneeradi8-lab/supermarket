import { NextRequest, NextResponse } from 'next/server';
import { publishDeliveryLocation } from '@/lib/ably';
import { requireSellerOrAdmin } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Order from '@/models/Order';

// PUT /api/orders/[id]/delivery - Update live delivery location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();
    const {
      latitude,
      longitude,
      etaMinutes,
      courierName,
      statusNote
    } = body;

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return NextResponse.json(
        { success: false, message: 'Valid latitude and longitude are required' },
        { status: 400 }
      );
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    order.deliveryTracking = {
      ...(order.deliveryTracking || {}),
      currentLocation: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        updatedAt: new Date()
      },
      etaMinutes: Number.isFinite(Number(etaMinutes)) ? Number(etaMinutes) : order.deliveryTracking?.etaMinutes,
      courierName: courierName || order.deliveryTracking?.courierName,
      statusNote: statusNote || order.deliveryTracking?.statusNote,
    };

    const updatedOrder = await order.save();

    await publishDeliveryLocation(String(order._id), {
      orderId: String(order._id),
      latitude: updatedOrder.deliveryTracking?.currentLocation?.latitude,
      longitude: updatedOrder.deliveryTracking?.currentLocation?.longitude,
      etaMinutes: updatedOrder.deliveryTracking?.etaMinutes,
      courierName: updatedOrder.deliveryTracking?.courierName,
      statusNote: updatedOrder.deliveryTracking?.statusNote,
      updatedAt: updatedOrder.deliveryTracking?.currentLocation?.updatedAt,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error updating delivery tracking:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update delivery tracking' },
      { status: 500 }
    );
  }
}