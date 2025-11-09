import nacl from 'tweetnacl';

type NodeBuffer = typeof import('buffer').Buffer;

const nodeBuffer: NodeBuffer | undefined = (globalThis as {
  Buffer?: NodeBuffer;
}).Buffer;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export const PUBLIC_KEY_BYTE_LENGTH = nacl.box.publicKeyLength;
export const SECRET_KEY_BYTE_LENGTH = nacl.box.secretKeyLength;
export const PUBLIC_KEY_BASE64_LENGTH = 44; // 32 bytes encoded as base64

export type GeneratedKeypair = {
  publicKey: string;
  secretKey: Uint8Array;
};

function assertWebCryptoAvailable(): void {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error(
      'Web Crypto API is not available. Update to a modern browser to continue.'
    );
  }
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is not supported in this environment.');
}

function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(value, 'base64'));
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

function validateEncodedKey(value: string): void {
  if (
    value.length !== PUBLIC_KEY_BASE64_LENGTH ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new Error(
      `Invalid public key format. Expected base64 string (${PUBLIC_KEY_BASE64_LENGTH} chars).`
    );
  }
}

export function encodePublicKey(key: Uint8Array): string {
  if (key.length !== PUBLIC_KEY_BYTE_LENGTH) {
    throw new Error(
      `Public key must be ${PUBLIC_KEY_BYTE_LENGTH} bytes before encoding.`
    );
  }
  return encodeBytesToBase64(key);
}

export function decodePublicKey(encodedKey: string): Uint8Array {
  validateEncodedKey(encodedKey);
  const bytes = decodeBase64ToBytes(encodedKey);
  if (bytes.length !== PUBLIC_KEY_BYTE_LENGTH) {
    throw new Error(
      `Decoded public key must be ${PUBLIC_KEY_BYTE_LENGTH} bytes.`
    );
  }
  return bytes;
}

export function generateKeypair(): GeneratedKeypair {
  assertWebCryptoAvailable();
  const { publicKey, secretKey } = nacl.box.keyPair();
  return {
    publicKey: encodePublicKey(publicKey),
    secretKey,
  };
}
