import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/security';

type AuthUser = {
  userId: string;
  email: string;
  role: string;
};

export function verifyToken(request: NextRequest): AuthUser | null {
  try {
    const jwtSecret = getJwtSecret();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    return jwt.verify(token, jwtSecret) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuthenticated(request: NextRequest) {
  const user = verifyToken(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  return {
    user,
    response: null
  };
}

export function requireRoles(request: NextRequest, roles: string[]) {
  const user = verifyToken(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  if (!roles.includes(user.role)) {
    return {
      user,
      response: NextResponse.json(
        { success: false, message: `Access denied. Required role: ${roles.join(' or ')}` },
        { status: 403 }
      )
    };
  }

  return {
    user,
    response: null
  };
}

export function requireSellerOrAdmin(request: NextRequest) {
  return requireRoles(request, ['seller', 'admin']);
}