import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random verification token
 * @returns 22-character base64url string (128-bit entropy)
 */
export function generateVerificationToken(): string {
  // Generate 16 random bytes (128 bits)
  const buffer = crypto.randomBytes(16);

  // Convert to base64url (URL-safe base64 without padding)
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hashes a token using SHA-256
 * @param token - The plain token to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}
