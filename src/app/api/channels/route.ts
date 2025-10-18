/**
 * Channels API
 * GET /api/channels - List all channels for user's family
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// GET /api/channels - List family channels
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Get user's family_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User record not found',
          },
        },
        { status: 404 }
      );
    }

    // Fetch all channels for user's family
    // RLS policies will enforce family isolation
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, family_id, name, description, icon, created_by, is_default, created_at')
      .eq('family_id', user.family_id)
      .order('created_at', { ascending: true }); // Default channel first

    if (channelsError) {
      console.error('Failed to fetch channels:', channelsError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch channels',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      channels: channels.map((c) => ({
        id: c.id,
        familyId: c.family_id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        createdBy: c.created_by,
        isDefault: c.is_default,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Fetch channels error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
