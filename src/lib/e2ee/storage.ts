/**
 * Secure client-side key storage using IndexedDB.
 * Keys persist across browser sessions but are cleared on logout.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ourchat-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

let db: IDBPDatabase | null = null;

/**
 * Opens or creates the IndexedDB database.
 */
async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Create object store for keys
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

  return db;
}

/**
 * Stores a CryptoKey in IndexedDB.
 * @param keyName - Identifier for the key (e.g., 'familyKey')
 * @param key - CryptoKey to store
 */
export async function storeKey(keyName: string, key: CryptoKey): Promise<void> {
  const database = await getDB();
  await database.put(STORE_NAME, key, keyName);
}

/**
 * Retrieves a CryptoKey from IndexedDB.
 * @param keyName - Identifier for the key
 * @returns CryptoKey or null if not found
 */
export async function retrieveKey(keyName: string): Promise<CryptoKey | null> {
  const database = await getDB();
  const key = await database.get(STORE_NAME, keyName);
  return key || null;
}

/**
 * Deletes a specific key from storage.
 * @param keyName - Identifier for the key
 */
export async function deleteKey(keyName: string): Promise<void> {
  const database = await getDB();
  await database.delete(STORE_NAME, keyName);
}

/**
 * Clears all keys from storage (on logout).
 */
export async function clearKeys(): Promise<void> {
  const database = await getDB();
  await database.clear(STORE_NAME);
}

/**
 * Lists all stored key names (for debugging).
 * @returns Array of key names
 */
export async function listKeys(): Promise<string[]> {
  const database = await getDB();
  return database.getAllKeys(STORE_NAME) as Promise<string[]>;
}
