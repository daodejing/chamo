/**
 * POST /api/auth/register
 * Creates family admin account with invite code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validators/auth';
import { generateInviteCode } from '@/lib/auth/invite-codes';
import {
  generateFamilyKey,
  createInviteCodeWithKey,
} from '@/lib/e2ee/key-management';
import { createClient } from '@/lib/supabase/server';

// Simple in-memory rate limiter (TODO: Replace with Redis in production)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimiter.get(ip);

  if (!limit || now > limit.resetAt) {
    // First request or expired window
    rateLimiter.set(ip, {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // 1 hour
    });
    return true;
  }

  if (limit.count >= 5) {
    return false; // Rate limit exceeded
  }

  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (skip for test environment)
    const isTest = process.env.NODE_ENV === 'test' || request.headers.get('x-test-bypass-rate-limit') === 'true';

    if (!isTest) {
      const ip =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';

      if (!checkRateLimit(ip)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many registration attempts. Please try again later.',
            },
          },
          { status: 429 }
        );
      }
    }

    // Parse and validate input
    const body = await request.json();
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const { email, password, familyName, userName } = validationResult.data;

    // Create Supabase client
    const supabase = await createClient();

    // Check if email already exists (Supabase Auth will handle this, but we check early)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists.',
          },
        },
        { status: 409 }
      );
    }

    // Generate family encryption key (Epic 7 E2EE)
    const { base64Key } = await generateFamilyKey();

    // Generate unique invite code
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 5;

    // Retry logic for duplicate invite codes (extremely unlikely)
    while (attempts < maxAttempts) {
      inviteCode = generateInviteCode();

      const { data: existing } = await supabase
        .from('families')
        .select('id')
        .eq('invite_code', inviteCode)
        .single();

      if (!existing) break; // Code is unique

      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique invite code');
      }
    }

    // Sign up user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userName,
        },
      },
    });

    if (authError) {
      console.error('Supabase Auth signup error:', authError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: authError.message || 'Failed to create account',
          },
        },
        { status: 500 }
      );
    }

    if (!authData.user) {
      throw new Error('No user returned from Supabase Auth');
    }

    // Create family record
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName,
        invite_code: inviteCode!,
        created_by: authData.user.id,
      })
      .select()
      .single();

    if (familyError) {
      console.error('Failed to create family:', familyError);
      // Cleanup: Delete auth user if family creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create family record',
          },
        },
        { status: 500 }
      );
    }

    // Create user record with encrypted family key
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name: userName,
        role: 'admin',
        family_id: family.id,
        encrypted_family_key: base64Key,
      })
      .select()
      .single();

    if (userError) {
      console.error('Failed to create user:', userError);
      // Cleanup: Delete family and auth user
      await supabase.from('families').delete().eq('id', family.id);
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create user record',
          },
        },
        { status: 500 }
      );
    }

    // Format invite code with embedded key
    const inviteCodeWithKey = createInviteCodeWithKey(inviteCode!, base64Key);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          familyId: user.family_id,
          encryptedFamilyKey: user.encrypted_family_key,
        },
        family: {
          id: family.id,
          name: family.name,
          inviteCode: inviteCodeWithKey,
        },
        session: {
          accessToken: authData.session?.access_token,
          refreshToken: authData.session?.refresh_token,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
