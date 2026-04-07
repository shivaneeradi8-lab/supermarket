import { createHmac, timingSafeEqual } from 'crypto';

type ProviderVerificationConfig = {
  secret: string | undefined;
  headerNames: string[];
};

const normalizeProvider = (value: unknown, fallback = 'generic') =>
  String(value || fallback).trim().toLowerCase();

const getProviderVerificationConfig = (provider: string): ProviderVerificationConfig => {
  const normalizedProvider = normalizeProvider(provider);

  switch (normalizedProvider) {
    case 'phonepe':
      return {
        secret: process.env.PHONEPE_WEBHOOK_SECRET,
        headerNames: ['x-phonepe-signature', 'x-phonepe-webhook-signature', 'x-verify'],
      };

    case 'paytm':
      return {
        secret: process.env.PAYTM_WEBHOOK_SECRET,
        headerNames: ['x-paytm-signature', 'x-checksumhash'],
      };

    case 'razorpay':
      return {
        secret: process.env.RAZORPAY_WEBHOOK_SECRET,
        headerNames: ['x-razorpay-signature'],
      };

    default:
      return {
        secret: process.env.UPI_WEBHOOK_SECRET_GENERIC,
        headerNames: ['x-upi-signature', 'x-webhook-signature'],
      };
  }
};

const getHeaderValue = (headers: Headers, headerNames: string[]) => {
  for (const headerName of headerNames) {
    const value = headers.get(headerName);
    if (value) {
      return value;
    }
  }

  return null;
};

const normalizeSignature = (signature: string) =>
  signature.replace(/^sha256=/i, '').trim();

const isHexSignature = (value: string) => /^[0-9a-f]+$/i.test(value);

export function verifyProviderWebhookSignature(
  rawBody: string,
  headers: Headers,
  provider: string
) {
  const config = getProviderVerificationConfig(provider);
  const signatureHeader = getHeaderValue(headers, config.headerNames);

  if (!config.secret || !signatureHeader) {
    return false;
  }

  const expectedSignature = createHmac('sha256', config.secret).update(rawBody).digest('hex');
  const providedSignature = normalizeSignature(signatureHeader);

  if (!isHexSignature(providedSignature)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const providedBuffer = Buffer.from(providedSignature, 'hex');

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}