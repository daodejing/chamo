-- Migration: Fix RLS policy for default channel creation via trigger
-- Date: 2025-10-18
-- Story: 2.1 - Send Messages in Different Channels (Review Fix H2)
--
-- Issue: The auto_create_default_channel() trigger violates RLS policies
-- when creating the "General" channel during user registration.
--
-- Root Cause: The existing "Admins can insert channels" policy checks auth.uid(),
-- which is not set when the SECURITY DEFINER function runs from a trigger.
--
-- Solution: Add a permissive policy that allows default channel creation
-- when the creator is a valid admin user in the target family.

-- ============================================================================
-- FIX: Add policy to allow default channel creation via trigger
-- ============================================================================

CREATE POLICY "Allow default channel creation for new families"
  ON channels FOR INSERT
  WITH CHECK (
    -- Allow if creating a default channel AND
    -- the creator is an admin of the target family
    is_default = TRUE
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = channels.created_by
        AND users.family_id = channels.family_id
        AND users.role = 'admin'
    )
  );

-- Note: This policy works alongside the existing "Admins can insert channels" policy.
-- RLS policies are combined with OR logic, so either policy can grant access.
-- This new policy specifically allows the trigger function to create default channels
-- during user registration without requiring auth.uid() to be set.
