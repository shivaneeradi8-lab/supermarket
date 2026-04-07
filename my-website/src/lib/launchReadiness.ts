const BLOCKED_PLACEHOLDER_VALUES = [
  'replace_with',
  'replace-with',
  'your_',
  'your-',
  'changeme',
  'example',
  'placeholder',
];

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

function isPlaceholder(value: string) {
  const normalized = String(value || '').trim().toLowerCase();
  return BLOCKED_PLACEHOLDER_VALUES.some((token) => normalized.includes(token));
}

export function requireEnvValue(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value || isPlaceholder(value)) {
    throw new Error(`${name} is not configured with a real value.`);
  }
  return value;
}

export function ensureAtlasUriForProduction(uri: string) {
  const normalized = String(uri || '').trim();

  if (!isProductionRuntime()) {
    return normalized;
  }

  if (!normalized.startsWith('mongodb+srv://')) {
    throw new Error('Production requires MongoDB Atlas SRV URI (mongodb+srv://...).');
  }

  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    throw new Error('Production cannot use localhost MongoDB URI. Use MongoDB Atlas.');
  }

  return normalized;
}

export function requireStripeSecretKey() {
  const value = requireEnvValue('STRIPE_SECRET_KEY');

  if (isProductionRuntime() && !value.startsWith('sk_live_')) {
    throw new Error('Production requires STRIPE_SECRET_KEY to be a live key (sk_live_...).');
  }

  return value;
}

export function requireStripeWebhookSecret() {
  const value = requireEnvValue('STRIPE_WEBHOOK_SECRET');

  if (!value.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must start with whsec_.');
  }

  return value;
}

export function requireOtpProviderConfig() {
  const provider = String(process.env.OTP_DELIVERY_PROVIDER || '').trim().toLowerCase();

  if (!provider) {
    throw new Error('OTP_DELIVERY_PROVIDER is not configured.');
  }

  if (provider === 'twilio-verify') {
    return {
      provider,
      accountSid: requireEnvValue('TWILIO_ACCOUNT_SID'),
      authToken: requireEnvValue('TWILIO_AUTH_TOKEN'),
      serviceSid: requireEnvValue('TWILIO_VERIFY_SERVICE_SID'),
    };
  }

  if (isProductionRuntime()) {
    throw new Error('Production requires OTP_DELIVERY_PROVIDER=twilio-verify for real server-side OTP.');
  }

  return { provider };
}
