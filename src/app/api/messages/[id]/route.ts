/**
 * Messages API - Single Message Operations
 * PATCH /api/messages/:id - Edit a message
 * DELETE /api/messages/:id - Delete a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const editMessageSchema = z.object({
  encryptedContent: z.string().min(1, 'Message content cannot be empty'),
});

// ============================================================================
// PATCH /api/messages/:id - Edit message
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const messageId = params.id;

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

    // Validate message ID format
    if (!messageId || !z.string().uuid().safeParse(messageId).success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid message ID format',
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    const validationResult = editMessageSchema.safeParse(body);

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

    const { encryptedContent } = validationResult.data;

    // Verify message exists and belongs to current user
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('id, user_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MESSAGE_NOT_FOUND',
            message: 'Message not found',
          },
        },
        { status: 404 }
      );
    }

    // Only allow users to edit their own messages
    if (existingMessage.user_id !== authUser.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only edit your own messages',
          },
        },
        { status: 403 }
      );
    }

    // Update message with RLS enforcing ownership
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        encrypted_content: encryptedContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select('id, channel_id, user_id, encrypted_content, timestamp, is_edited, edited_at')
      .single();

    if (updateError) {
      console.error('Failed to update message:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to update message',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: {
          id: updatedMessage.id,
          channelId: updatedMessage.channel_id,
          userId: updatedMessage.user_id,
          encryptedContent: updatedMessage.encrypted_content,
          timestamp: updatedMessage.timestamp,
          isEdited: updatedMessage.is_edited,
          editedAt: updatedMessage.edited_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Edit message error:', error);

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
// DELETE /api/messages/:id - Delete message
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const messageId = params.id;

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

    // Validate message ID format
    if (!messageId || !z.string().uuid().safeParse(messageId).success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid message ID format',
          },
        },
        { status: 400 }
      );
    }

    // Verify message exists and belongs to current user before deleting
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('id, user_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MESSAGE_NOT_FOUND',
            message: 'Message not found',
          },
        },
        { status: 404 }
      );
    }

    // Only allow users to delete their own messages
    if (existingMessage.user_id !== authUser.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only delete your own messages',
          },
        },
        { status: 403 }
      );
    }

    // Delete message (RLS policy "Users can delete their own messages" enforces ownership)
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      console.error('Failed to delete message:', deleteError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to delete message',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Message deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete message error:', error);

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
