import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import nacl from 'tweetnacl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __dangerous__closeCryptoStorageForTests,
  __dangerous__wipeCryptoStorageForTests,
  getPrivateKey,
  hasPrivateKey,
  storePrivateKey,
} from '@/lib/crypto/secure-storage';
import { SECRET_KEY_BYTE_LENGTH } from '@/lib/crypto/keypair';

if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto as unknown as Crypto;
}

const baseNavigator = {
  userAgent: 'Vitest',
  language: 'en-US',
  platform: 'MacIntel',
} as Navigator;

const baseScreen = {
  width: 1920,
  height: 1080,
  colorDepth: 24,
} as Screen;

const baseWindow = {
  devicePixelRatio: 2,
} as Window & typeof globalThis;

const randomKey = () => nacl.randomBytes(SECRET_KEY_BYTE_LENGTH);

beforeEach(async () => {
  (globalThis as any).navigator = { ...baseNavigator };
  (globalThis as any).screen = { ...baseScreen };
  (globalThis as any).window = { ...baseWindow };
  await __dangerous__wipeCryptoStorageForTests();
});

afterEach(async () => {
  await __dangerous__wipeCryptoStorageForTests();
});

describe('secure storage', () => {
  it('stores and retrieves private keys', async () => {
    const userId = 'user-123';
    const secretKey = randomKey();

    await storePrivateKey(userId, secretKey);
    const retrieved = await getPrivateKey(userId);

    expect(retrieved).not.toBeNull();
    expect(Array.from(retrieved ?? [])).toEqual(Array.from(secretKey));
  });

  it('handles multiple users without collisions', async () => {
    const firstKey = randomKey();
    const secondKey = randomKey();

    await storePrivateKey('alice', firstKey);
    await storePrivateKey('bob', secondKey);

    const aliceKey = await getPrivateKey('alice');
    const bobKey = await getPrivateKey('bob');

    expect(Array.from(aliceKey ?? [])).toEqual(Array.from(firstKey));
    expect(Array.from(bobKey ?? [])).toEqual(Array.from(secondKey));
  });

  it('reports existence via hasPrivateKey()', async () => {
    expect(await hasPrivateKey('ghost')).toBe(false);
    await storePrivateKey('ghost', randomKey());
    expect(await hasPrivateKey('ghost')).toBe(true);
  });

  it('derives deterministic device keys so data survives reload', async () => {
    const userId = 'persist-user';
    const key = randomKey();

    await storePrivateKey(userId, key);
    await __dangerous__closeCryptoStorageForTests(); // simulate tab reload

    const reloadedKey = await getPrivateKey(userId);
    expect(reloadedKey).not.toBeNull();
    expect(Array.from(reloadedKey ?? [])).toEqual(Array.from(key));
  });

  it('throws descriptive error when IndexedDB is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    const originalKeyRange = (globalThis as any).IDBKeyRange;
    // Simulate legacy browser / server environment
    // @ts-expect-error - intentionally removing IndexedDB globals
    delete (globalThis as any).indexedDB;
    // @ts-expect-error - intentionally removing IndexedDB globals
    delete (globalThis as any).IDBKeyRange;

    await expect(storePrivateKey('legacy-user', randomKey())).rejects.toThrow(
      /IndexedDB is not available/
    );

    globalThis.indexedDB = originalIndexedDb;
    (globalThis as any).IDBKeyRange = originalKeyRange;
  });

  it('rejects keys that are not 32 bytes long', async () => {
    const invalidKey = new Uint8Array(SECRET_KEY_BYTE_LENGTH - 1);
    await expect(storePrivateKey('short-key', invalidKey)).rejects.toThrow(
      /Private key must be/
    );
  });
});
