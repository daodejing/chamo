-- Migration: Create default "General" channel for existing families
-- Date: 2025-10-13
-- Story: 2.1 - Send Messages in Different Channels
--
-- This migration ensures every family has a default "General" channel
-- for messaging. New families will also get this channel automatically.

-- ============================================================================
-- FUNCTION: Create default "General" channel for a family
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_channel_for_family(p_family_id UUID, p_creator_id UUID)
RETURNS UUID AS $$
DECLARE
  v_channel_id UUID;
BEGIN
  -- Check if family already has a default channel
  SELECT id INTO v_channel_id
  FROM channels
  WHERE family_id = p_family_id AND is_default = TRUE
  LIMIT 1;

  -- If no default channel exists, create one
  IF v_channel_id IS NULL THEN
    INSERT INTO channels (family_id, name, description, icon, created_by, is_default)
    VALUES (
      p_family_id,
      'General',
      'Main family chat channel',
      '💬',
      p_creator_id,
      TRUE
    )
    RETURNING id INTO v_channel_id;
  END IF;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BACKFILL: Create default "General" channel for existing families
-- ============================================================================

DO $$
DECLARE
  family_record RECORD;
BEGIN
  -- For each existing family without a default channel
  FOR family_record IN
    SELECT f.id as family_id, f.created_by as creator_id
    FROM families f
    WHERE NOT EXISTS (
      SELECT 1 FROM channels c
      WHERE c.family_id = f.id AND c.is_default = TRUE
    )
  LOOP
    -- Create default channel (function handles the logic)
    PERFORM create_default_channel_for_family(
      family_record.family_id,
      family_record.creator_id
    );
  END LOOP;
END $$;

-- ============================================================================
-- TRIGGER: Auto-create default channel when admin user is created
-- ============================================================================
-- Note: Trigger on users table instead of families table to ensure
-- the user record exists before creating channels (foreign key constraint)

CREATE OR REPLACE FUNCTION auto_create_default_channel()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create default channel when an admin user is created
  -- This happens after family creation, so user exists for foreign key
  IF NEW.role = 'admin' THEN
    PERFORM create_default_channel_for_family(NEW.family_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_default_channel
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_default_channel();
