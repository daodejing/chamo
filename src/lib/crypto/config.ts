/**
 * Shared configuration for per-user encryption key storage.
 * Task 1 only provisions constants; Tasks 2-3 will consume them.
 */
export type CryptoStorageConfig = {
  /** IndexedDB database name reserved for encrypted key material */
  dbName: string;
  /** Schema version for Dexie */
  version: number;
  /** Table map passed to Dexie.version().stores() */
  stores: Record<string, string>;
  /** Tables protected by dexie-encrypted along with fingerprint inputs */
  encryption: {
    tables: string[];
    fingerprintFields: string[];
  };
  /** Soft bundle budget (KB) for all crypto libs combined */
  bundleBudgetKb: number;
};

export const USER_KEYS_TABLE = 'userKeys';
export const USER_KEYS_PRIMARY_KEY = 'userId';

export const cryptoStorageConfig: CryptoStorageConfig = {
  dbName: 'chamo_encryption',
  version: 1,
  stores: {
    [USER_KEYS_TABLE]: `${USER_KEYS_PRIMARY_KEY}`,
  },
  encryption: {
    tables: [USER_KEYS_TABLE],
    fingerprintFields: [
      'navigator.userAgent',
      'navigator.language',
      'screen.width',
      'screen.height',
      'window.devicePixelRatio',
    ],
  },
  bundleBudgetKb: 42,
};

export const deviceFingerprintSeedOrder = Object.freeze([
  'navigator.userAgent',
  'navigator.language',
  'navigator.platform',
  'screen.width',
  'screen.height',
  'screen.colorDepth',
]);

export type DeviceFingerprintSeed = (typeof deviceFingerprintSeedOrder)[number];
