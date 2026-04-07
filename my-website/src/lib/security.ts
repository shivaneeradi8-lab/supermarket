import crypto from 'crypto';

const MIN_JWT_SECRET_LENGTH = 32;
const BLOCKED_JWT_SECRETS = new Set([
  'local_dev_jwt_secret_change_me',
  'your-super-secret-jwt-key-change-this-in-production',
  'otp-dev-secret',
  'changeme',
  'secret',
]);

export function getJwtSecret() {
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters.`);
  }

  if (BLOCKED_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET must not use a known placeholder value.');
  }

  return jwtSecret;
}

export function hashOtpCode(phone: string, otp: string, jwtSecret = getJwtSecret()) {
  return crypto
    .createHash('sha256')
    .update(`${phone}:${otp}:${jwtSecret}`)
    .digest('hex');
}