/**
 * Invite Encryption Module
 *
 * Encrypts family keys for secure invite distribution using asymmetric encryption.
 * The family key is encrypted with the invitee's public key, ensuring only they
 * can decrypt it with their private key (E2EE).
 */

import nacl from 'tweetnacl';
import { decodePublicKey } from '../crypto/keypair';
import { getPrivateKey } from '../crypto/secure-storage';

/**
 * Encrypts a family key for a specific recipient using their public key.
 *
 * @param familyKeyBase64 - Base64-encoded family encryption key (AES-256)
 * @param recipientPublicKeyBase64 - Base64-encoded recipient's X25519 public key
 * @param senderUserId - Current user's ID (to retrieve sender's secret key)
 * @returns Object containing encrypted data and nonce, both base64-encoded
 *
 * @throws Error if encryption fails or keys are invalid
 */
export async function encryptFamilyKeyForRecipient(
  familyKeyBase64: string,
  recipientPublicKeyBase64: string,
  senderUserId: string,
): Promise<{ encryptedKey: string; nonce: string }> {
  // Decode the family key from base64 to bytes
  const familyKeyBytes = Uint8Array.from(atob(familyKeyBase64), (c) => c.charCodeAt(0));

  // Decode recipient's public key
  const recipientPublicKey = decodePublicKey(recipientPublicKeyBase64);

  // Get sender's private key from secure storage
  const senderSecretKey = await getPrivateKey(senderUserId);
  if (!senderSecretKey) {
    throw new Error('Sender private key not found. Please ensure you have registered properly.');
  }

  // Generate random nonce (24 bytes for nacl.box)
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt family key using nacl.box
  // This uses the sender's secret key and recipient's public key
  // Only the recipient can decrypt with their secret key
  const encryptedBytes = nacl.box(
    familyKeyBytes,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  // Encode to base64 for storage/transmission
  const encryptedKey = btoa(String.fromCharCode(...encryptedBytes));
  const nonceBase64 = btoa(String.fromCharCode(...nonce));

  return {
    encryptedKey,
    nonce: nonceBase64,
  };
}

/**
 * Decrypts a family key that was encrypted for the current user.
 *
 * @param encryptedKeyBase64 - Base64-encoded encrypted family key
 * @param nonceBase64 - Base64-encoded nonce used during encryption
 * @param senderPublicKeyBase64 - Base64-encoded sender's public key
 * @param recipientUserId - Current user's ID (to retrieve private key)
 * @returns Base64-encoded decrypted family key
 *
 * @throws Error if decryption fails or keys are invalid
 */
export async function decryptFamilyKey(
  encryptedKeyBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string,
  recipientUserId: string,
): Promise<string> {
  // Decode inputs from base64
  const encryptedBytes = Uint8Array.from(atob(encryptedKeyBase64), (c) => c.charCodeAt(0));
  const nonce = Uint8Array.from(atob(nonceBase64), (c) => c.charCodeAt(0));
  const senderPublicKey = decodePublicKey(senderPublicKeyBase64);

  // Get recipient's private key from secure storage
  const recipientSecretKey = await getPrivateKey(recipientUserId);
  if (!recipientSecretKey) {
    throw new Error('Recipient private key not found. Cannot decrypt invite.');
  }

  // Decrypt using nacl.box.open
  const decryptedBytes = nacl.box.open(
    encryptedBytes,
    nonce,
    senderPublicKey,
    recipientSecretKey
  );

  if (!decryptedBytes) {
    throw new Error('Decryption failed. Invalid encrypted data or keys.');
  }

  // Encode decrypted family key to base64
  return btoa(String.fromCharCode(...decryptedBytes));
}
