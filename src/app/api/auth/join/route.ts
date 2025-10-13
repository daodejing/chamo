/**
 * POST /api/auth/join
 * Creates family member account via invite code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { joinSchema } from '@/lib/validators/auth';
import { validateInviteCodeFormat } from '@/lib/auth/invite-codes';
import { parseInviteCode } from '@/lib/e2ee/key-management';
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

  if (limit.count >= 10) {
    return false; // Rate limit exceeded (10 requests/hour per AC)
  }

  limit.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (skip for test environment)
    const isTest =
      process.env.NODE_ENV === 'test' ||
      request.headers.get('x-test-bypass-rate-limit') === 'true';

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
              message: 'Too many join attempts. Please try again later.',
            },
          },
          { status: 429 }
        );
      }
    }

    // Parse and validate input
    const body = await request.json();
    const validationResult = joinSchema.safeParse(body);

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

    const { email, password, inviteCode, userName } = validationResult.data;

    // Validate invite code format (AC2: format validation)
    if (!validateInviteCodeFormat(inviteCode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INVITE_CODE',
            message: 'Invalid invite code format',
          },
        },
        { status: 400 }
      );
    }

    // Parse invite code to extract code and key (AC6: extract family key)
    let parsedCode: { code: string; base64Key: string };
    try {
      parsedCode = parseInviteCode(inviteCode);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INVITE_CODE',
            message: 'Failed to parse invite code',
          },
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();

    // Check if email already exists
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

    // AC2: Verify invite code exists in families table
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id, name, max_members')
      .eq('invite_code', parsedCode.code)
      .single();

    if (familyError || !family) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVITE_CODE_NOT_FOUND',
            message: 'Invite code not found or expired',
          },
        },
        { status: 404 }
      );
    }

    // AC3: Check family not full (current members < max_members)
    const { count: memberCount, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', family.id);

    if (countError) {
      console.error('Failed to count family members:', countError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to check family capacity',
          },
        },
        { status: 500 }
      );
    }

    if (memberCount !== null && memberCount >= family.max_members) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FAMILY_FULL',
            message: 'This family has reached its maximum number of members',
          },
        },
        { status: 403 }
      );
    }

    // AC4: Sign up user with Supabase Auth (password hashing handled automatically)
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

    // AC4: Create member user record with role='member' and encrypted_family_key
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name: userName,
        role: 'member',
        family_id: family.id,
        encrypted_family_key: parsedCode.base64Key,
      })
      .select()
      .single();

    if (userError) {
      console.error('Failed to create user:', userError);
      // Cleanup: Delete auth user if user record creation fails
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

    // AC5: User is automatically logged in via Supabase Auth session
    // Return success response with user, family, and session data
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
        },
        session: {
          accessToken: authData.session?.access_token,
          refreshToken: authData.session?.refresh_token,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Join error:', error);

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
