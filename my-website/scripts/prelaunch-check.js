/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const REQUIRED_ROUTE_FILES = [
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/request-otp/route.ts',
  'src/app/api/auth/verify-otp/route.ts',
  'src/app/api/orders/route.ts',
  'src/app/api/payments/route.ts',
  'src/app/api/payments/webhook/route.ts',
  'src/app/api/payments/upi/webhook/route.ts',
];

const BLOCKED_TOKENS = [
  'replace_with',
  'replace-with',
  'changeme',
  'your_',
  'your-',
  'example',
  'placeholder',
];

function loadEnvFile(filePath, overrideExisting = false) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (overrideExisting || typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

function readText(relativePath) {
  const abs = path.join(process.cwd(), relativePath);
  return fs.readFileSync(abs, 'utf8');
}

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return BLOCKED_TOKENS.some((token) => normalized.includes(token));
}

function check(condition, successMessage, failureMessage, failures) {
  if (condition) {
    console.log(`PASS  ${successMessage}`);
    return;
  }

  console.error(`FAIL  ${failureMessage}`);
  failures.push(failureMessage);
}

async function checkMongoAtlasConnection(failures) {
  const uri = String(process.env.MONGODB_URI || '').trim();
  check(
    uri.startsWith('mongodb+srv://') && !uri.includes('localhost') && !uri.includes('127.0.0.1'),
    'MongoDB URI is Atlas SRV format',
    'MONGODB_URI must be mongodb+srv:// and not localhost for launch',
    failures
  );

  if (!uri || isPlaceholder(uri)) {
    failures.push('MONGODB_URI is not set to a real Atlas connection string');
    console.error('FAIL  MONGODB_URI is not set to a real Atlas connection string');
    return;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });

    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('PASS  MongoDB Atlas connectivity check succeeded (ping=1)');
  } catch (error) {
    const message = `MongoDB Atlas connectivity failed: ${error && error.message ? error.message : String(error)}`;
    failures.push(message);
    console.error(`FAIL  ${message}`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

function checkDevLoginRemoved(failures) {
  const loginRoute = readText('src/app/api/auth/login/route.ts');

  check(
    !/admin123|password123|ALLOW_DEV_LOGIN|DEV_LOGIN|bypass/i.test(loginRoute),
    'No dev-login bypass patterns detected in login route',
    'Dev login bypass pattern found in auth login route',
    failures
  );

  check(
    String(process.env.ALLOW_DEV_LOGIN || '').toLowerCase() !== 'true',
    'ALLOW_DEV_LOGIN is disabled',
    'ALLOW_DEV_LOGIN=true must be removed before launch',
    failures
  );
}

function checkOtpWorking(failures) {
  const provider = String(process.env.OTP_DELIVERY_PROVIDER || '').trim().toLowerCase();

  check(
    provider === 'twilio-verify',
    'OTP delivery provider is twilio-verify',
    'OTP_DELIVERY_PROVIDER must be twilio-verify for real server-side OTP',
    failures
  );

  check(!isPlaceholder(process.env.TWILIO_ACCOUNT_SID), 'TWILIO_ACCOUNT_SID is set', 'TWILIO_ACCOUNT_SID is missing/placeholder', failures);
  check(!isPlaceholder(process.env.TWILIO_AUTH_TOKEN), 'TWILIO_AUTH_TOKEN is set', 'TWILIO_AUTH_TOKEN is missing/placeholder', failures);
  check(!isPlaceholder(process.env.TWILIO_VERIFY_SERVICE_SID), 'TWILIO_VERIFY_SERVICE_SID is set', 'TWILIO_VERIFY_SERVICE_SID is missing/placeholder', failures);
}

function checkStripeLive(failures) {
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const stripePublishable = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();

  check(
    stripeSecret.startsWith('sk_live_') && !isPlaceholder(stripeSecret),
    'STRIPE_SECRET_KEY is a live key',
    'STRIPE_SECRET_KEY must be a real sk_live_ key',
    failures
  );

  check(
    stripePublishable.startsWith('pk_live_') && !isPlaceholder(stripePublishable),
    'STRIPE_PUBLISHABLE_KEY is a live key',
    'STRIPE_PUBLISHABLE_KEY must be a real pk_live_ key',
    failures
  );
}

function checkWebhooksVerified(failures) {
  const stripeWebhookRoute = readText('src/app/api/payments/webhook/route.ts');
  const upiWebhookRoute = readText('src/app/api/payments/upi/webhook/route.ts');

  check(
    !isPlaceholder(process.env.STRIPE_WEBHOOK_SECRET) && String(process.env.STRIPE_WEBHOOK_SECRET || '').startsWith('whsec_'),
    'STRIPE_WEBHOOK_SECRET is configured',
    'STRIPE_WEBHOOK_SECRET must be configured with a real whsec_ secret',
    failures
  );

  check(
    stripeWebhookRoute.includes('constructEvent') && stripeWebhookRoute.includes('stripe-signature'),
    'Stripe webhook route verifies signatures',
    'Stripe webhook verification logic not detected',
    failures
  );

  check(
    upiWebhookRoute.includes('verifyProviderWebhookSignature('),
    'UPI webhook route verifies provider signatures',
    'UPI webhook verification logic not detected',
    failures
  );
}

function checkBackgroundJobsConfigured(failures) {
  const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
  const maintenanceRoutePath = 'src/app/api/maintenance/expire-pending-orders/route.ts';
  const maintenanceRoute = readText(maintenanceRoutePath);

  check(
    !isPlaceholder(process.env.CRON_SECRET) && String(process.env.CRON_SECRET || '').length >= 32,
    'CRON_SECRET is configured',
    'CRON_SECRET must be configured with a long random secret',
    failures
  );

  if (!fs.existsSync(vercelConfigPath)) {
    failures.push('vercel.json is missing, so production cron is not configured');
    console.error('FAIL  vercel.json is missing, so production cron is not configured');
    return;
  }

  let parsedVercelConfig = null;
  try {
    parsedVercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
  } catch {
    failures.push('vercel.json is not valid JSON');
    console.error('FAIL  vercel.json is not valid JSON');
    return;
  }

  const cronEntries = Array.isArray(parsedVercelConfig.crons) ? parsedVercelConfig.crons : [];
  const pendingOrderSweepCron = cronEntries.find(
    (entry) => entry && entry.path === '/api/maintenance/expire-pending-orders' && typeof entry.schedule === 'string' && entry.schedule.trim().length > 0
  );

  check(
    Boolean(pendingOrderSweepCron),
    'vercel.json contains automatic cron for pending-order sweep',
    'vercel.json must schedule /api/maintenance/expire-pending-orders automatically',
    failures
  );

  check(
    maintenanceRoute.includes('export async function GET('),
    `${maintenanceRoutePath} exports GET for scheduler access`,
    `${maintenanceRoutePath} must export GET so Vercel cron can trigger it`,
    failures
  );

  check(
    maintenanceRoute.includes('expirePendingUpiOrders('),
    `${maintenanceRoutePath} runs pending-order expiry logic`,
    `${maintenanceRoutePath} must invoke expirePendingUpiOrders`,
    failures
  );
}

function checkJwtSecret(failures) {
  const jwtSecret = String(process.env.JWT_SECRET || '').trim();

  check(
    jwtSecret.length >= 64 && !isPlaceholder(jwtSecret),
    'JWT_SECRET is at least 64 chars and non-placeholder',
    'JWT_SECRET must be a real high-entropy value with at least 64 characters',
    failures
  );
}

function checkRateLimitingAdded(failures) {
  for (const routeFile of REQUIRED_ROUTE_FILES) {
    const body = readText(routeFile);
    check(
      body.includes('consumeRateLimit('),
      `${routeFile} contains rate limiting`,
      `${routeFile} is missing consumeRateLimit usage`,
      failures
    );
  }
}

function checkErrorLoggingAdded(failures) {
  for (const routeFile of REQUIRED_ROUTE_FILES) {
    const body = readText(routeFile);
    check(
      body.includes('internalErrorResponse('),
      `${routeFile} uses structured error logging`,
      `${routeFile} is missing internalErrorResponse usage`,
      failures
    );
  }
}

async function main() {
  const failures = [];

  loadEnvFile(path.join(process.cwd(), '.env'));
  loadEnvFile(path.join(process.cwd(), '.env.local'), true);

  console.log('Running prelaunch checks...');
  console.log('');

  await checkMongoAtlasConnection(failures);
  checkDevLoginRemoved(failures);
  checkOtpWorking(failures);
  checkStripeLive(failures);
  checkWebhooksVerified(failures);
  checkBackgroundJobsConfigured(failures);
  checkJwtSecret(failures);
  checkRateLimitingAdded(failures);
  checkErrorLoggingAdded(failures);

  console.log('');

  if (failures.length > 0) {
    console.error(`Prelaunch check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log('All prelaunch checks passed. Ready for launch.');
}

main().catch((error) => {
  console.error('Prelaunch check crashed:', error);
  process.exit(1);
});
