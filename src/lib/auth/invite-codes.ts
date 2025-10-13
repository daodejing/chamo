/**
 * Invite code generation and validation utilities.
 */

import { customAlphabet } from 'nanoid';

// Generate 8-character alphanumeric codes (uppercase for readability)
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

/**
 * Generates a unique invite code in format: FAMILY-XXXXXXXX
 * @returns Invite code string
 */
export function generateInviteCode(): string {
  return `FAMILY-${nanoid()}`;
}

/**
 * Validates invite code format (with embedded key).
 * Expected format: FAMILY-XXXXXXXX:BASE64KEY
 * @param code - Invite code to validate
 * @returns true if valid format, false otherwise
 */
export function validateInviteCodeFormat(code: string): boolean {
  // Format: FAMILY-{8 alphanumeric}:{base64 string}
  return /^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/.test(code);
}
