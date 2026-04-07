import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256),
  phone: z.string().trim().max(32).optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      zipCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g. +919876543210).'),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g. +919876543210).'),
  otp: z.string().trim().regex(/^\d{4,8}$/, 'OTP must be 4 to 8 digits.'),
});

export const createOrderSchema = z.object({
  orderItems: z
    .array(
      z.object({
        product: z.string().trim().min(1).max(64),
        quantity: z.number().int().positive().max(999),
      })
    )
    .min(1),
  shippingAddress: z.object({
    street: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().max(100).optional(),
    zipCode: z.string().trim().min(1).max(20),
    country: z.string().trim().max(100).optional(),
    fullName: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(32).optional(),
  }),
  paymentMethod: z.string().trim().min(1).max(32),
  paymentProvider: z.string().trim().max(32).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  clientRequestId: z.string().trim().min(8).max(128).optional(),
});

export const createPaymentIntentSchema = z.object({
  orderId: z.string().trim().min(1).max(64),
});

export const createReviewSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().max(32).optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      zipCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(100).optional(),
    })
    .optional(),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(320),
});
