import { generateVerificationToken, hashToken } from './token.util';

/**
 * Generates a cryptographically secure random invite code
 * Uses crypto.randomBytes(16) for 128-bit entropy
 * @returns 22-character base64url string (URL-safe, no padding)
 */
export function generateInviteCode(): string {
  // Reuse the existing secure token generation (same algorithm)
  return generateVerificationToken();
}

/**
 * Hashes an invite code using SHA-256
 * @param inviteCode - The plain invite code to hash
 * @returns Hex-encoded SHA-256 hash (64 characters) for database lookup
 */
export function hashInviteCode(inviteCode: string): string {
  // Reuse the existing SHA-256 hashing function
  return hashToken(inviteCode);
}
