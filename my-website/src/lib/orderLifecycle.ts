import mongoose, { type ClientSession } from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import StockLog from '@/models/StockLog';
import { upsertPaymentLifecycle } from '@/lib/paymentLifecycle';

const DEFAULT_SOFT_RESERVATION_MINUTES = 5;
const DEFAULT_PENDING_EXPIRY_GRACE_SECONDS = 120;

type SessionOptions = {
  session?: ClientSession;
};

type OrderItemLike = {
  product: unknown;
  quantity: number;
};

type PaymentResultLike = {
  provider?: string;
  id?: string;
  reason?: string;
  status?: string;
  [key: string]: unknown;
};

type OrderLike = {
  _id: unknown;
  user: unknown;
  orderItems?: OrderItemLike[];
  isPaid?: boolean;
  status: string;
  pendingExpiresAt?: Date | string;
  paymentMethod: string;
  paymentResult?: PaymentResultLike;
  totalPrice: number;
  save: (options?: { session?: ClientSession }) => Promise<unknown>;
};

export async function withMongoTransaction<T>(work: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    if (typeof result === 'undefined') {
      throw new Error('Transaction completed without a result.');
    }

    return result;
  } finally {
    await session.endSession();
  }
}

export function getSoftReservationMs() {
  const ttlMinutes = Number(
    process.env.SOFT_RESERVATION_TTL_MINUTES ||
    process.env.SOFT_RESERVATION_MINUTES ||
    process.env.PENDING_ORDER_TTL_MINUTES ||
    process.env.UPI_PENDING_ORDER_TTL_MINUTES ||
    DEFAULT_SOFT_RESERVATION_MINUTES
  );
  const normalizedMinutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0
    ? ttlMinutes
    : DEFAULT_SOFT_RESERVATION_MINUTES;

  return normalizedMinutes * 60 * 1000;
}

export function getPendingOrderExpiryDate() {
  return new Date(Date.now() + getSoftReservationMs());
}

function getPendingOrderExpiryGraceMs() {
  const graceSeconds = Number(
    process.env.PENDING_ORDER_EXPIRY_GRACE_SECONDS ||
    process.env.PENDING_ORDER_GRACE_SECONDS ||
    DEFAULT_PENDING_EXPIRY_GRACE_SECONDS
  );

  const normalizedSeconds = Number.isFinite(graceSeconds) && graceSeconds >= 0
    ? graceSeconds
    : DEFAULT_PENDING_EXPIRY_GRACE_SECONDS;

  return normalizedSeconds * 1000;
}

export async function restoreOrderStock(order: OrderLike, options: SessionOptions = {}) {
  const { session } = options;

  for (const item of order.orderItems || []) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) {
      continue;
    }

    const product = session
      ? await Product.findById(item.product).session(session)
      : await Product.findById(item.product);

    if (!product) {
      continue;
    }

    const beforeStock = Number(product.stock) || 0;
    const currentStock = Math.max(0, Number(product.currentStock ?? product.stock) || 0);
    product.stock = Math.max(0, Math.min(currentStock, beforeStock + quantity));
    await product.save(session ? { session } : undefined);

    await StockLog.create([{
      productId: product._id,
      orderId: order._id,
      type: 'release',
      quantity,
      beforeStock,
      afterStock: Number(product.stock) || 0,
      source: 'order',
      note: 'Released reserved units from cancelled/expired order'
    }], session ? { session } : undefined);
  }
}

export async function applyOrderSale(order: OrderLike, options: SessionOptions = {}) {
  const { session } = options;

  for (const item of order.orderItems || []) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) {
      continue;
    }

    const product = session
      ? await Product.findById(item.product).session(session)
      : await Product.findById(item.product);

    if (!product) {
      continue;
    }

    const beforeStock = Number(product.currentStock ?? product.stock) || 0;
    if (beforeStock < quantity) {
      throw new Error(`Insufficient current stock to finalize sale for product ${String(item.product)}`);
    }

    product.currentStock = Math.max(0, beforeStock - quantity);

    const availableStock = Number(product.stock) || 0;
    if (product.currentStock < availableStock) {
      product.stock = product.currentStock;
    }

    await product.save(session ? { session } : undefined);

    await StockLog.create([{
      productId: product._id,
      orderId: order._id,
      type: 'sale',
      quantity,
      beforeStock,
      afterStock: Number(product.currentStock) || 0,
      source: 'order',
      note: 'Sale completed and physical stock deducted'
    }], session ? { session } : undefined);
  }
}

export function isOrderExpired(order: OrderLike | null | undefined) {
  if (!order || order.isPaid || order.status !== 'pending') {
    return false;
  }

  if (!order.pendingExpiresAt) {
    return false;
  }

  const expiresAtMs = new Date(order.pendingExpiresAt).getTime();
  const graceMs = getPendingOrderExpiryGraceMs();

  return expiresAtMs + graceMs <= Date.now();
}

export async function expireOrderIfStale(order: OrderLike, options: SessionOptions = {}) {
  const { session } = options;

  const expireWork = async (activeSession: ClientSession) => {
    const transactionalOrder = await Order.findById(order._id).session(activeSession);
    if (!transactionalOrder || !isOrderExpired(transactionalOrder)) {
      return false;
    }

    await restoreOrderStock(transactionalOrder, { session: activeSession });

    transactionalOrder.status = 'cancelled';
    transactionalOrder.pendingExpiresAt = undefined;
    transactionalOrder.paymentResult = {
      ...(transactionalOrder.paymentResult || {}),
      status: 'cancelled',
      reason: 'expired'
    };

    await upsertPaymentLifecycle({
      orderId: String(transactionalOrder._id),
      userId: String(transactionalOrder.user),
      method: transactionalOrder.paymentMethod,
      provider: (transactionalOrder.paymentResult?.provider || transactionalOrder.paymentMethod || 'generic') as 'stripe' | 'paypal' | 'cod' | 'upi' | 'phonepe' | 'paytm' | 'razorpay' | 'generic',
      status: 'expired',
      amount: Number(transactionalOrder.totalPrice),
      currency: 'INR',
      providerPaymentId: transactionalOrder.paymentResult?.id,
      failureReason: 'expired',
      cancelledAt: new Date(),
      metadata: {
        source: 'order.expire',
      },
      session: activeSession,
    });

    await transactionalOrder.save({ session: activeSession });
    return true;
  };

  if (session) {
    if (!isOrderExpired(order)) {
      return false;
    }

    return expireWork(session);
  }

  if (!isOrderExpired(order)) {
    return false;
  }

  return withMongoTransaction(expireWork);
}

/**
 * Hard-confirms a soft reservation after verified payment.
 *
 * Soft reservation (order creation): decrements `currentStock` and sets
 * `pendingExpiresAt` so the background sweep can reclaim unfinished orders.
 *
 * Hard confirmation (this function): calls `applyOrderSale()` to permanently
 * commit the stock deduction (also adjusting `product.stock`), then clears
 * `pendingExpiresAt` so the expiry sweep ignores this order going forward.
 */
export async function hardConfirmReservation(order: OrderLike, options: SessionOptions = {}) {
  await applyOrderSale(order, options);
  order.pendingExpiresAt = undefined;
}

export async function expirePendingUpiOrders() {
  const graceMs = getPendingOrderExpiryGraceMs();
  const cutoff = new Date(Date.now() - graceMs);

  const expiredOrders = await Order.find({
    status: 'pending',
    isPaid: false,
    pendingExpiresAt: { $lte: cutoff }
  });

  let expiredCount = 0;

  for (const order of expiredOrders) {
    const didExpire = await expireOrderIfStale(order);
    if (didExpire) {
      expiredCount += 1;
    }
  }

  return expiredCount;
}

// Backward-compatible alias for callers that still use UPI-specific naming.
export async function expirePendingOrders() {
  return expirePendingUpiOrders();
}