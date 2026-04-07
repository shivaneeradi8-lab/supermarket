import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { Types } from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { createRateLimitResponse, consumeRateLimit, getRequestIp } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { createReviewSchema } from '@/lib/validation';

const READ_WINDOW_MS = 60 * 1000;
const READ_LIMIT = 60;
const WRITE_WINDOW_MS = 10 * 60 * 1000;
const WRITE_LIMIT = 5;

// GET /api/reviews?productId=xxx&page=1&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    if (!productId) {
      return NextResponse.json(
        { success: false, message: 'productId is required' },
        { status: 400 }
      );
    }

    const rateLimit = consumeRateLimit(
      `reviews:list:${getRequestIp(request)}`,
      READ_LIMIT,
      READ_WINDOW_MS
    );
    if (rateLimit.limited) {
      return createRateLimitResponse('Too many requests. Please try again later.', rateLimit);
    }

    await connectToDatabase();

    const skip = (page - 1) * limit;
    if (!Types.ObjectId.isValid(productId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid productId' },
        { status: 400 }
      );
    }

    const [reviews, total] = await Promise.all([
      Review.find({ product: productId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ product: productId }),
    ]);

    const avgRatingResult = await Review.aggregate([
      { $match: { product: new Types.ObjectId(productId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    const avgRating = avgRatingResult[0]?.avg ?? 0;

    return NextResponse.json({
      success: true,
      data: reviews,
      meta: {
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return internalErrorResponse(error, 'Failed to fetch reviews');
  }
}

// POST /api/reviews
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
      `reviews:create:${getRequestIp(request)}:${user.userId}`,
      WRITE_LIMIT,
      WRITE_WINDOW_MS
    );
    if (rateLimit.limited) {
      return createRateLimitResponse('Too many review submissions. Please try again later.', rateLimit);
    }

    const parsedBody = createReviewSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const { productId, rating, comment } = parsedBody.data;

    await connectToDatabase();

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // Only allow review if user has a completed/delivered order containing this product
    const verifiedOrder = await Order.findOne({
      user: user.userId,
      status: { $in: ['success', 'delivered'] },
      'orderItems.product': productId,
    });

    const existing = await Review.findOne({ product: productId, user: user.userId });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'You have already reviewed this product' },
        { status: 409 }
      );
    }

    const review = await Review.create({
      product: productId,
      user: user.userId,
      userName: user.email.split('@')[0],
      rating,
      comment,
      verifiedPurchase: !!verifiedOrder,
    });

    // Update product aggregate rating
    const agg = await Review.aggregate([
      { $match: { product: review.product } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg[0]) {
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(agg[0].avg * 10) / 10,
        numReviews: agg[0].count,
      });
    }

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { success: false, message: 'You have already reviewed this product' },
        { status: 409 }
      );
    }
    return internalErrorResponse(error, 'Failed to submit review');
  }
}
