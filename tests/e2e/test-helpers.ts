/**
 * Test Helper Functions
 * Shared utilities for E2E tests
 */

/**
 * Generates a cryptographically secure invite code.
 * Uses the SAME logic as the frontend (src/lib/e2ee/key-management.ts)
 * Format: FAMILY-XXXXXXXXXXXXXXXX (128-bit random code)
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
  const codeLength = 16; // 128-bit entropy (33^16)

  // Node.js crypto for tests
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(codeLength);

  const code = Array.from(randomBytes, (byte: number) =>
    chars.charAt(byte % chars.length)
  ).join('');

  return `FAMILY-${code}`;
}

/**
 * Generates a test family encryption key (base64)
 */
export function generateTestFamilyKey(testId: string): string {
  return Buffer.from(`test-family-key-${testId}`).toString('base64');
}

/**
 * Creates a full invite code with key (CODE:KEY format)
 */
export function createFullInviteCode(code: string, key: string): string {
  return `${code}:${key}`;
}
