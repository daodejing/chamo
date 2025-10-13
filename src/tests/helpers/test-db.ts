import { createClient } from '@supabase/supabase-js';

/**
 * Test helper utilities for integration tests.
 * Provides service role client for cleanup operations.
 * Uses standard dev Supabase instance (port 54321).
 */

// Supabase configuration (uses environment variables from vitest.config.ts)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

/**
 * Creates a Supabase client with service role access for test setup/cleanup.
 * This client bypasses RLS policies and should only be used in tests.
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a regular Supabase client with anon key (for testing client-side operations).
 */
export function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Tracks created test data for cleanup.
 */
export class TestDataTracker {
  private familyIds: string[] = [];
  private userIds: string[] = [];
  private emails: string[] = [];

  trackFamily(id: string) {
    this.familyIds.push(id);
  }

  trackUser(id: string, email?: string) {
    this.userIds.push(id);
    if (email) this.emails.push(email);
  }

  /**
   * Clean up all tracked test data using admin client.
   */
  async cleanup() {
    const admin = createAdminClient();

    // Delete auth users first (by user ID, not email)
    if (this.userIds.length > 0) {
      for (const userId of this.userIds) {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch (error: any) {
          // Silently ignore - auth users might not exist or we might not have permission
          if (error?.message && !error.message.includes('not found')) {
            console.warn(`Could not delete auth user ${userId}:`, error.message);
          }
        }
      }
    }

    // Delete users from users table (CASCADE will handle related records)
    if (this.userIds.length > 0) {
      try {
        await admin.from('users').delete().in('id', this.userIds);
      } catch (error: any) {
        console.warn('Could not delete users:', error.message);
      }
    }

    // Delete families (CASCADE will handle channels, etc.)
    if (this.familyIds.length > 0) {
      try {
        await admin.from('families').delete().in('id', this.familyIds);
      } catch (error: any) {
        console.warn('Could not delete families:', error.message);
      }
    }

    this.reset();
  }

  reset() {
    this.familyIds = [];
    this.userIds = [];
    this.emails = [];
  }
}
