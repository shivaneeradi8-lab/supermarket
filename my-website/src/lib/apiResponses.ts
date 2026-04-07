import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import crypto from 'crypto';
import { captureError } from '@/lib/logger';

export function validationErrorResponse(error: ZodError) {
  const firstIssue = error.issues[0];
  return NextResponse.json(
    {
      success: false,
      message: firstIssue?.message || 'Invalid request payload',
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

export function internalErrorResponse(error: unknown, fallbackMessage: string) {
  const requestId = crypto.randomUUID();
  captureError(error, { requestId, fallbackMessage });

  return NextResponse.json(
    {
      success: false,
      message: fallbackMessage,
      requestId,
    },
    { status: 500 }
  );
}
