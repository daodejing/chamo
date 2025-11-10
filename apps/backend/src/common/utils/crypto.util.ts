import * as crypto from 'crypto';

/**
 * Validates that the INVITE_SECRET is a 64-character hex string (32 bytes)
 * This should be called at application startup
 * @throws Error if INVITE_SECRET is invalid or missing
 */
export function validateInviteSecret(): void {
  const secret = process.env.INVITE_SECRET;

  if (!secret) {
    throw new Error('INVITE_SECRET environment variable is not set. Generate one with: openssl rand -hex 32');
  }

  if (secret.length !== 64) {
    throw new Error(`INVITE_SECRET must be exactly 64 characters (32 bytes hex), got ${secret.length} characters`);
  }

  // Validate it's a valid hex string
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error('INVITE_SECRET must be a valid 64-character hexadecimal string');
  }
}

/**
 * Derives a 32-byte key from the INVITE_SECRET hex string
 * @returns 32-byte Buffer for use with AES-256
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.INVITE_SECRET;

  if (!secret) {
    throw new Error('INVITE_SECRET environment variable is not set');
  }

  // Convert hex string to Buffer (32 bytes for AES-256)
  return Buffer.from(secret, 'hex');
}

/**
 * Encrypts an email address using AES-256-GCM
 * @param email - The email address to encrypt
 * @returns Base64-encoded string containing IV + ciphertext + auth tag
 */
export function encryptEmail(email: string): string {
  const key = getEncryptionKey();

  // Generate random 12-byte IV (recommended for GCM)
  const iv = crypto.randomBytes(12);

  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  // Encrypt the email
  let encrypted = cipher.update(email, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get the authentication tag (16 bytes for GCM)
  const authTag = cipher.getAuthTag();

  // Concatenate: IV (12 bytes) + ciphertext (variable) + auth tag (16 bytes)
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);

  // Return as base64
  return combined.toString('base64');
}

/**
 * Decrypts an email address encrypted with AES-256-GCM
 * @param encrypted - Base64-encoded string containing IV + ciphertext + auth tag
 * @returns The decrypted email address
 * @throws Error if decryption fails or auth tag verification fails (tampered data)
 */
export function decryptEmail(encrypted: string): string {
  const key = getEncryptionKey();

  // Decode from base64
  const combined = Buffer.from(encrypted, 'base64');

  // Extract components
  const iv = combined.subarray(0, 12);                        // First 12 bytes
  const authTag = combined.subarray(combined.length - 16);    // Last 16 bytes
  const ciphertext = combined.subarray(12, combined.length - 16); // Middle part

  // Create decipher with AES-256-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  // Set the auth tag for verification
  decipher.setAuthTag(authTag);

  try {
    // Decrypt the email
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Auth tag verification failed or decryption error
    throw new Error('Email decryption failed: data may have been tampered with or is corrupted');
  }
}
