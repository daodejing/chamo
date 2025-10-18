/**
 * GET /api/auth/session
 * Validates JWT token and returns current user session data.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user (validates JWT with auth server - more secure than getSession)
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(null, { status: 200 });
    }

    // Look up user data with family info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        name,
        role,
        family_id,
        encrypted_family_key,
        families (
          id,
          name,
          avatar
        )
      `
      )
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      console.error('Failed to fetch user data:', userError);
      return NextResponse.json(null, { status: 200 });
    }

    // Type assertion: Supabase returns families as an object, not array
    const family = user.families as unknown as { id: string; name: string; avatar: string | null };

    // Update last_seen_at timestamp
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', authUser.id);

    // Format response per tech spec
    return NextResponse.json({
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
        avatar: family.avatar,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate session',
        },
      },
      { status: 500 }
    );
  }
}
