import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import StockLog from '@/models/StockLog';

// GET /api/products/logs/[productId] - Fetch stock logs for a product
export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await connectToDatabase();
    const { productId } = await params;
    const logs = await StockLog.find({ productId }).sort({ date: -1 }).populate('userId', 'name email').lean();
    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching stock logs:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch stock logs' }, { status: 500 });
  }
}
