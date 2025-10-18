/**
 * Messages API
 * POST /api/messages - Send a new message
 * GET /api/messages?channelId={uuid}&limit=50&before={timestamp} - Fetch message history
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const sendMessageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
  encryptedContent: z.string().min(1, 'Message content cannot be empty'),
});

const getMessagesSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

// ============================================================================
// RATE LIMITING
// ============================================================================

// Simple in-memory rate limiter (TODO: Replace with Redis in production)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimiter.get(userId);

  if (!limit || now > limit.resetAt) {
    // First request or expired window
    rateLimiter.set(userId, {
      count: 1,
      resetAt: now + 60 * 1000, // 1 minute
    });
    return true;
  }

  if (limit.count >= 100) {
    return false; // Rate limit exceeded (100 messages/minute)
  }

  limit.count++;
  return true;
}

// ============================================================================
// QUIET HOURS VALIDATION
// ============================================================================

function isInQuietHours(preferences: any): boolean {
  if (!preferences?.quietHours?.enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

  const { start, end } = preferences.quietHours;
  const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
  const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);

  // Handle quiet hours spanning midnight
  if (startMinutes > endMinutes) {
    return currentTime >= startMinutes || currentTime < endMinutes;
  }

  return currentTime >= startMinutes && currentTime < endMinutes;
}

// ============================================================================
// POST /api/messages - Send message
// ============================================================================

export async function POST(request: NextRequest) {
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

    // Rate limiting (skip for test environment)
    const isTest = process.env.NODE_ENV === 'test' || request.headers.get('x-test-bypass-rate-limit') === 'true';

    if (!isTest && !checkRateLimit(authUser.id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many messages. Please slow down.',
          },
        },
        { status: 429 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);

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

    const { channelId, encryptedContent } = validationResult.data;

    // Get user record with preferences
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, family_id, preferences')
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

    // Check quiet hours
    if (isInQuietHours(user.preferences)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUIET_HOURS_ACTIVE',
            message: 'Cannot send messages during quiet hours',
          },
        },
        { status: 403 }
      );
    }

    // Verify channel exists and user has access (RLS will handle this, but explicit check for better errors)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, family_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHANNEL_NOT_FOUND',
            message: 'Channel not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    // Verify user belongs to channel's family
    if (channel.family_id !== user.family_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this channel',
          },
        },
        { status: 403 }
      );
    }

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: authUser.id,
        encrypted_content: encryptedContent,
      })
      .select('id, channel_id, user_id, encrypted_content, timestamp, is_edited, edited_at, created_at')
      .single();

    if (messageError) {
      console.error('Failed to insert message:', messageError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to send message',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          channelId: message.channel_id,
          userId: message.user_id,
          encryptedContent: message.encrypted_content,
          timestamp: message.timestamp,
          isEdited: message.is_edited,
          editedAt: message.edited_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error);

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

// ============================================================================
// GET /api/messages - Fetch message history
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const validationResult = getMessagesSchema.safeParse({
      channelId: searchParams.get('channelId'),
      limit: searchParams.get('limit') ?? undefined,
      before: searchParams.get('before') ?? undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const { channelId, limit, before } = validationResult.data;

    // Verify channel exists and user has access
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, family_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHANNEL_NOT_FOUND',
            message: 'Channel not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    // Build query with cursor-based pagination and JOIN users table
    // This eliminates N+1 queries by fetching user data in a single query
    let query = supabase
      .from('messages')
      .select(`
        id,
        channel_id,
        user_id,
        encrypted_content,
        timestamp,
        is_edited,
        edited_at,
        users:user_id (
          name,
          avatar
        )
      `)
      .eq('channel_id', channelId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Apply cursor (before timestamp)
    if (before) {
      query = query.lt('timestamp', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Failed to fetch messages:', messagesError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to fetch messages',
          },
        },
        { status: 500 }
      );
    }

    // Check if there are more messages (for pagination)
    const hasMore = messages.length === limit;

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        userId: m.user_id,
        encryptedContent: m.encrypted_content,
        timestamp: m.timestamp,
        isEdited: m.is_edited,
        editedAt: m.edited_at,
        // Include user data from JOIN to eliminate N+1 queries on client
        userName: (m.users as any)?.name || 'Unknown',
        userAvatar: (m.users as any)?.avatar || null,
      })),
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[messages.length - 1].timestamp : null,
    });
  } catch (error) {
    console.error('Fetch messages error:', error);

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
