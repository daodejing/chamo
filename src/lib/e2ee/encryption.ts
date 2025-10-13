/**
 * Core E2EE encryption library for OurChat.
 * Uses AES-256-GCM (Web Crypto API) for all encryption operations.
 */

import { EncryptedPayload, DecryptedPayload } from '@/types/e2ee';

/**
 * Encrypts a text message using the family key.
 * @param plaintext - The message to encrypt
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Base64-encoded ciphertext (IV prepended)
 */
export async function encryptMessage(
  plaintext: string,
  familyKey: CryptoKey
): Promise<string> {
  // Encode plaintext to UTF-8 bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (96 bits for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128, // 128-bit authentication tag
    },
    familyKey,
    data
  );

  // Combine IV + ciphertext + auth tag
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Encode as base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an encrypted message.
 * @param encrypted - Base64-encoded ciphertext (IV prepended)
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Decrypted plaintext message
 * @throws Error if decryption fails (wrong key or corrupted data)
 */
export async function decryptMessage(
  encrypted: string,
  familyKey: CryptoKey
): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt with AES-256-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      familyKey,
      ciphertext
    );

    // Decode UTF-8 bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    // Don't expose crypto details in error message
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message. You may not have access to this family.');
  }
}

/**
 * Encrypts a file (photo) using the family key.
 * @param blob - The file blob to encrypt
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Encrypted blob (IV prepended)
 */
export async function encryptFile(
  blob: Blob,
  familyKey: CryptoKey
): Promise<Blob> {
  // Read file as ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    familyKey,
    arrayBuffer
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as blob (opaque binary)
  return new Blob([combined], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted file.
 * @param encryptedBlob - Encrypted blob (IV prepended)
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Decrypted blob with original MIME type
 */
export async function decryptFile(
  encryptedBlob: Blob,
  familyKey: CryptoKey
): Promise<Blob> {
  try {
    // Read encrypted blob as ArrayBuffer
    const combined = new Uint8Array(await encryptedBlob.arrayBuffer());

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt with AES-256-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      familyKey,
      ciphertext
    );

    // Detect original MIME type from magic numbers
    const mimeType = detectMimeType(new Uint8Array(plaintext));

    return new Blob([plaintext], { type: mimeType });
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt photo. You may not have access to this family.');
  }
}

/**
 * Detects MIME type from file magic numbers.
 * @param bytes - First bytes of file
 * @returns MIME type string
 */
function detectMimeType(bytes: Uint8Array): string {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // HEIC/HEIF: Check for "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image/heic';
  }
  // WebP: "RIFF" ... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Default to JPEG if unknown
  return 'image/jpeg';
}

/**
 * Batch encrypt multiple messages (for efficiency).
 * @param plaintexts - Array of messages to encrypt
 * @param familyKey - The family's shared key
 * @returns Array of encrypted messages
 */
export async function encryptMessageBatch(
  plaintexts: string[],
  familyKey: CryptoKey
): Promise<string[]> {
  return Promise.all(plaintexts.map((msg) => encryptMessage(msg, familyKey)));
}

/**
 * Batch decrypt multiple messages.
 * @param encryptedMessages - Array of encrypted messages
 * @param familyKey - The family's shared key
 * @returns Array of decrypted messages
 */
export async function decryptMessageBatch(
  encryptedMessages: string[],
  familyKey: CryptoKey
): Promise<string[]> {
  return Promise.all(encryptedMessages.map((msg) => decryptMessage(msg, familyKey)));
}
