/**
 * POST /api/auth/logout
 * Invalidates Supabase Auth session and clears HTTP-only cookies.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Invalidate session server-side (clears cookies)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOGOUT_ERROR',
            message: 'Failed to clear session',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during logout',
        },
      },
      { status: 500 }
    );
  }
}
