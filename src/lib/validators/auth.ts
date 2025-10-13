/**
 * Zod validation schemas for authentication endpoints.
 */

import { z } from 'zod';

/**
 * Registration schema for creating family admin accounts.
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  familyName: z
    .string()
    .min(2, 'Family name must be at least 2 characters')
    .max(50, 'Family name must be less than 50 characters'),
  userName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Join schema for family members joining via invite code.
 */
export const joinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteCode: z
    .string()
    .regex(
      /^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/,
      'Invalid invite code format'
    ),
  userName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
});

export type JoinInput = z.infer<typeof joinSchema>;

/**
 * Login schema for existing users.
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
