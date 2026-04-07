import { NextRequest, NextResponse } from 'next/server';
import { requireSellerOrAdmin } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Order from '@/models/Order';

// GET /api/orders/weekly - Fetch all orders created in the last 7 days (seller/admin)
export async function GET(request: NextRequest) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      createdAt: { $gte: weekAgo, $lte: now }
    })
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .lean();

    return NextResponse.json({
      success: true,
      data: orders,
      meta: {
        from: weekAgo.toISOString(),
        to: now.toISOString(),
        total: orders.length
      }
    });
  } catch (error) {
    console.error('Error fetching weekly orders:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch weekly orders' },
      { status: 500 }
    );
  }
}
