import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { type ClientSession } from 'mongoose';
import { verifyToken } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { expirePendingUpiOrders, getPendingOrderExpiryDate, getSoftReservationMs, withMongoTransaction } from '@/lib/orderLifecycle';
import { calculateOrderPricing } from '@/lib/orderPricing';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';
import Order from '@/models/Order';
import Product from '@/models/Product';
import StockLog from '@/models/StockLog';
import { buildUserIpEndpointRateLimitKey, createRateLimitResponse, consumeRateLimit } from '@/lib/rateLimit';
import { internalErrorResponse, validationErrorResponse } from '@/lib/apiResponses';
import { createOrderSchema } from '@/lib/validation';

const SUPPORTED_PAYMENT_METHODS = new Set(['stripe', 'paypal', 'cod', 'upi']);
const UPI_PROVIDERS = new Set(['phonepe', 'gpay', 'paytm']);
const ORDER_READ_WINDOW_MS = 5 * 60 * 1000;
const ORDER_READ_LIMIT = 60;
const CREATE_ORDER_WINDOW_MS = 10 * 60 * 1000;
const CREATE_ORDER_LIMIT = 20;
// NOTE: Idempotency window intentionally matches the soft-reservation TTL so a
// client retry arriving any time before expiry returns the existing order instead
// of creating a second reservation. See getSoftReservationMs() in orderLifecycle.
const getIdempotencyLookbackMs = () => getSoftReservationMs();

function normalizePaymentMethod(paymentMethod: string) {
  const normalized = String(paymentMethod || '').trim().toLowerCase();

  if (SUPPORTED_PAYMENT_METHODS.has(normalized)) {
    return normalized;
  }

  if (UPI_PROVIDERS.has(normalized)) {
    return 'upi';
  }

  return null;
}

function buildOrderFingerprint(input: {
  userId: string;
  orderItems: Array<{ product: string; quantity: number }>;
  shippingAddress: Record<string, unknown>;
  paymentMethod: string;
  paymentProvider?: string;
}) {
  const normalizedItems = input.orderItems
    .map((item) => ({ product: String(item.product), quantity: Number(item.quantity) }))
    .sort((a, b) => a.product.localeCompare(b.product));

  const payload = JSON.stringify({
    userId: String(input.userId),
    orderItems: normalizedItems,
    shippingAddress: {
      street: String(input.shippingAddress?.street || ''),
      city: String(input.shippingAddress?.city || ''),
      zipCode: String(input.shippingAddress?.zipCode || ''),
      country: String(input.shippingAddress?.country || ''),
    },
    paymentMethod: String(input.paymentMethod || ''),
    paymentProvider: String(input.paymentProvider || ''),
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

function isDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: number }).code === 11000;
}

function isTaggedOrderError(error: unknown, tag: string) {
  return error instanceof Error && error.message.startsWith(`${tag}:`);
}

function getTaggedOrderErrorValue(error: unknown, tag: string) {
  return error instanceof Error ? error.message.slice(`${tag}:`.length) : '';
}

type PricedProductInput = {
  _id: unknown;
  name: string;
  image: string;
  price: number;
  salePrice?: number;
  isSaleActive?: boolean;
  effectivePrice?: number;
};

async function reserveStockAndCreateOrder(input: {
  session: ClientSession;
  orderItems: Array<{ product: string; quantity: number }>;
  shippingAddress: Record<string, unknown>;
  normalizedPaymentMethod: string;
  paymentProvider?: string;
  deliveryNotes?: string;
  clientRequestId?: string;
  orderFingerprint: string;
  userId: string;
}) {
  const requestedByProduct = new Map<string, number>();

  for (const item of input.orderItems) {
    const quantity = Number(item?.quantity);
    const productId = String(item?.product || '').trim();

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('INVALID_ORDER_ITEM:Each order item must include a product and quantity');
    }

    requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + quantity);
  }

  // Pre-check the total requested quantity for each product before mutating stock.
  for (const [productId, totalRequested] of requestedByProduct.entries()) {
    const available = await Product.findOne({
      _id: productId,
      isActive: true,
      stock: { $gte: totalRequested }
    }).session(input.session);

    if (!available) {
      throw new Error(`INSUFFICIENT_STOCK:${productId}`);
    }
  }

  const reservedByProduct = new Map<string, PricedProductInput>();

  for (const [productId, totalRequested] of requestedByProduct.entries()) {
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        isActive: true,
        stock: { $gte: totalRequested }
      },
      {
        $inc: { stock: -totalRequested }
      },
      {
        new: true,
        session: input.session
      }
    );

    if (!product) {
      throw new Error(`INSUFFICIENT_STOCK:${productId}`);
    }

    const afterStock = Number(product.stock) || 0;
    const beforeStock = afterStock + totalRequested;

    await StockLog.create([{
      productId: product._id,
      type: 'reserve',
      quantity: totalRequested,
      beforeStock,
      afterStock,
      source: 'order',
      note: 'Reserved units at checkout'
    }], { session: input.session });

    reservedByProduct.set(String(product._id), {
      _id: product._id,
      name: String(product.name || ''),
      image: String(product.image || ''),
      price: Number(product.price || 0),
      salePrice: typeof product.salePrice === 'number' ? product.salePrice : undefined,
      isSaleActive: Boolean(product.isSaleActive),
      effectivePrice: typeof product.effectivePrice === 'number' ? product.effectivePrice : undefined,
    });
  }

  const reservedProducts: PricedProductInput[] = input.orderItems.map((item) => {
    const product = reservedByProduct.get(String(item.product));

    if (!product) {
      throw new Error(`INSUFFICIENT_STOCK:${String(item.product)}`);
    }

    return product;
  });

  const {
    orderItemsWithDetails,
    taxPrice,
    shippingPrice,
    totalPrice
  } = calculateOrderPricing(reservedProducts, input.orderItems);

  const order = new Order({
    user: input.userId,
    orderItems: orderItemsWithDetails,
    shippingAddress: input.shippingAddress,
    paymentMethod: input.normalizedPaymentMethod,
    paymentResult: {
      status: 'pending',
      provider: input.paymentProvider || input.normalizedPaymentMethod
    },
    taxPrice,
    shippingPrice,
    totalPrice,
    deliveryNotes: input.deliveryNotes,
    status: 'pending',
    pendingExpiresAt: input.normalizedPaymentMethod !== 'cod' ? getPendingOrderExpiryDate() : undefined,
    clientRequestId: input.clientRequestId,
    orderFingerprint: input.orderFingerprint,
    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  });

  const savedOrder = await order.save({ session: input.session });

  await upsertPaymentLifecycle({
    orderId: String(savedOrder._id),
    userId: input.userId,
    method: input.normalizedPaymentMethod as 'stripe' | 'paypal' | 'cod' | 'upi',
    provider: (input.paymentProvider || input.normalizedPaymentMethod) as 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic',
    status: 'pending',
    amount: Number(savedOrder.totalPrice),
    currency: 'INR',
    expiresAt: savedOrder.pendingExpiresAt,
    metadata: {
      source: 'order.create',
      clientRequestId: input.clientRequestId,
    },
    session: input.session,
  });

  return savedOrder;
}

// GET /api/orders - Fetch user's orders
export async function GET(request: NextRequest) {
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
        endpoint: 'orders:list',
        userId: String(user.userId),
      }),
      ORDER_READ_LIMIT,
      ORDER_READ_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many order lookup requests. Please try again later.', rateLimit);
    }

    await connectToDatabase();
    await expirePendingUpiOrders();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // Build query
    const query: { user: string; status?: string } = { user: user.userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .lean();

    const total = await Order.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create a new order
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
        endpoint: 'checkout:create-order',
        userId: String(user.userId),
      }),
      CREATE_ORDER_LIMIT,
      CREATE_ORDER_WINDOW_MS
    );

    if (rateLimit.limited) {
      return createRateLimitResponse('Too many order requests. Please try again later.', rateLimit);
    }

    const parsedBody = createOrderSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    await connectToDatabase();
    await expirePendingUpiOrders();

    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      paymentProvider,
      deliveryNotes,
      clientRequestId,
    } = parsedBody.data;

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

    if (!normalizedPaymentMethod) {
      return NextResponse.json(
        { success: false, message: 'A supported payment method is required' },
        { status: 400 }
      );
    }

    const orderFingerprint = buildOrderFingerprint({
      userId: user.userId,
      orderItems,
      shippingAddress,
      paymentMethod: normalizedPaymentMethod,
      paymentProvider,
    });

    const recentWindowStart = new Date(Date.now() - getIdempotencyLookbackMs());

    if (clientRequestId) {
      const existingByRequestId = await Order.findOne({
        user: user.userId,
        clientRequestId,
        createdAt: { $gte: recentWindowStart },
      }).sort({ createdAt: -1 });

      if (existingByRequestId) {
        return NextResponse.json({
          success: true,
          data: existingByRequestId,
          message: 'Duplicate order submission ignored (idempotent request).'
        });
      }
    }

    const existingByFingerprint = await Order.findOne({
      user: user.userId,
      orderFingerprint,
      status: 'pending',
      isPaid: false,
      createdAt: { $gte: recentWindowStart },
    }).sort({ createdAt: -1 });

    if (existingByFingerprint) {
      return NextResponse.json({
        success: true,
        data: existingByFingerprint,
        message: 'Duplicate pending order prevented.'
      });
    }

    try {
      const savedOrder = await withMongoTransaction((session) =>
        reserveStockAndCreateOrder({
          session,
          orderItems,
          shippingAddress,
          normalizedPaymentMethod,
          paymentProvider,
          deliveryNotes,
          clientRequestId,
          orderFingerprint,
          userId: user.userId,
        })
      );

      return NextResponse.json({
        success: true,
        data: savedOrder
      }, { status: 201 });
    } catch (error) {
      if (isTaggedOrderError(error, 'INVALID_ORDER_ITEM')) {
        return NextResponse.json(
          { success: false, message: getTaggedOrderErrorValue(error, 'INVALID_ORDER_ITEM') },
          { status: 400 }
        );
      }

      if (isTaggedOrderError(error, 'INSUFFICIENT_STOCK')) {
        return NextResponse.json(
          { success: false, message: `Insufficient stock or unavailable product for ${getTaggedOrderErrorValue(error, 'INSUFFICIENT_STOCK')}` },
          { status: 400 }
        );
      }

      if (isDuplicateKeyError(error)) {
        const duplicateOrder = clientRequestId
          ? await Order.findOne({ user: user.userId, clientRequestId }).sort({ createdAt: -1 })
          : await Order.findOne({
              user: user.userId,
              orderFingerprint,
              status: 'pending',
              isPaid: false,
            }).sort({ createdAt: -1 });

        if (duplicateOrder) {
          return NextResponse.json({
            success: true,
            data: duplicateOrder,
            message: 'Duplicate order submission prevented.'
          });
        }
      }

      throw error;
    }

  } catch (error) {
    return internalErrorResponse(error, 'Failed to create order');
  }
}