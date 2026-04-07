import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'Stripe-Signature', 'X-Upi-Provider'];
const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function getAllowedOrigins() {
  return String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function withCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS.join(', '));
  response.headers.set('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS.join(', '));
  response.headers.set('Access-Control-Max-Age', '600');
  response.headers.set('Vary', 'Origin');
  return response;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  // Server-to-server callbacks (Stripe/UPI webhooks) typically do not send Origin.
  if (!origin) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.next();
  }

  const isAllowed = allowedOrigins.includes(origin);
  if (!isAllowed) {
    return NextResponse.json(
      { success: false, message: 'Origin not allowed by CORS policy' },
      { status: 403 }
    );
  }

  if (request.method === 'OPTIONS') {
    return withCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  return withCorsHeaders(NextResponse.next(), origin);
}

export const config = {
  matcher: ['/api/:path*'],
};
