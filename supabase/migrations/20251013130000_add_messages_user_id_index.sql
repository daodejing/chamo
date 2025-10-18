-- Migration: Add user_id index to messages table for performance
-- Date: 2025-10-13
-- Story: 2.1 - Send Messages in Different Channels
-- Task: 1.4 - Add database indexes for performance (user_id)

-- Add index on messages.user_id for efficient queries filtering by user
-- This supports queries like "get all messages by user X" and JOIN operations
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
