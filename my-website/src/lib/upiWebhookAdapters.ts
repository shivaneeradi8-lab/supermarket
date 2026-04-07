export type NormalizedUpiWebhookPayload = {
  orderId: string;
  status: string;
  provider: string;
  transactionId?: string;
  amount?: number;
  email?: string;
};

type AdapterContext = {
  providerHint?: string;
};

type GenericPayload = Record<string, unknown>;

const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeProvider = (value: unknown, fallback = 'upi') => String(value || fallback).trim().toLowerCase();
const normalizeOrderId = (value: unknown) => String(value || '').trim();
const optionalString = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value == null ? undefined : String(value);
};

const parseAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function normalizeGenericPayload(payload: GenericPayload, context: AdapterContext): NormalizedUpiWebhookPayload {
  return {
    orderId: normalizeOrderId(payload.orderId || payload.order_id || payload.merchantOrderId || payload.txnid),
    status: normalizeStatus(payload.status || payload.paymentStatus || payload.payment_status || payload.txnStatus),
    provider: normalizeProvider(payload.provider || payload.gateway || context.providerHint),
    transactionId: optionalString(payload.transactionId || payload.transaction_id || payload.providerReferenceId || payload.txnId),
    amount: parseAmount(payload.amount || payload.paymentAmount || payload.txnAmount),
    email: optionalString(payload.email || payload.customerEmail || payload.receiptEmail),
  };
}

function normalizePhonePePayload(payload: GenericPayload): NormalizedUpiWebhookPayload {
  const data = ((payload.response || payload.data || payload) as GenericPayload);

  return {
    orderId: normalizeOrderId(data.merchantTransactionId || data.orderId || payload.orderId),
    status: normalizeStatus(data.state || data.status),
    provider: 'phonepe',
    transactionId: optionalString(data.transactionId || data.providerReferenceId),
    amount: parseAmount((data.amount ?? payload.amount) ? Number(data.amount ?? payload.amount) / 100 : undefined),
    email: optionalString(payload.email),
  };
}

function normalizePaytmPayload(payload: GenericPayload): NormalizedUpiWebhookPayload {
  const body = ((payload.body || payload) as GenericPayload);

  return {
    orderId: normalizeOrderId(body.orderId || body.ORDERID),
    status: normalizeStatus(body.resultStatus || body.STATUS),
    provider: 'paytm',
    transactionId: optionalString(body.txnId || body.TXNID),
    amount: parseAmount(body.txnAmount || body.TXNAMOUNT),
    email: optionalString(body.customerEmail),
  };
}

function normalizeRazorpayPayload(payload: GenericPayload): NormalizedUpiWebhookPayload {
  const payloadNode = (payload.payload as GenericPayload | undefined);
  const payloadPayment = payloadNode?.payment as GenericPayload | undefined;
  const paymentNode = payload.payment as GenericPayload | undefined;
  const entity = ((payloadPayment?.entity || paymentNode?.entity || payload) as GenericPayload);
  const notes = (entity.notes as GenericPayload | undefined) || {};

  return {
    orderId: normalizeOrderId(notes.orderId || entity.order_id || payload.orderId),
    status: normalizeStatus(entity.status || payload.status),
    provider: 'razorpay',
    transactionId: optionalString(entity.id || payload.transactionId),
    amount: parseAmount(entity.amount ? Number(entity.amount) / 100 : payload.amount),
    email: optionalString(entity.email || payload.email),
  };
}

const providerAdapters: Record<string, (payload: GenericPayload, context: AdapterContext) => NormalizedUpiWebhookPayload> = {
  generic: normalizeGenericPayload,
  phonepe: (payload) => normalizePhonePePayload(payload),
  paytm: (payload) => normalizePaytmPayload(payload),
  razorpay: (payload) => normalizeRazorpayPayload(payload),
};

export function normalizeUpiWebhookPayload(
  payload: GenericPayload,
  context: AdapterContext = {}
) {
  const providerKey = normalizeProvider(context.providerHint || payload.provider || payload.gateway, 'generic');
  const adapter = providerAdapters[providerKey] || providerAdapters.generic;
  return adapter(payload, context);
}