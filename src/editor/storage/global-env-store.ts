// ─── Global Environments Store ───────────────────────────────────────────────
// Stores environments that are shared across all apps (global-level).
// Separate from app-level environments stored on each AppEntry.

import { Environment } from '../../schema';

const DB_NAME = 'testkaro-global';
const DB_VERSION = 1;
const ENV_STORE = 'environments';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENV_STORE)) {
        db.createObjectStore(ENV_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get all global environments */
export async function getGlobalEnvironments(): Promise<Environment[]> {
  const db = await openDB();
  const tx = db.transaction(ENV_STORE, 'readonly');
  const store = tx.objectStore(ENV_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Save a global environment (create or update) */
export async function saveGlobalEnvironment(env: Environment): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ENV_STORE, 'readwrite');
  const store = tx.objectStore(ENV_STORE);
  return new Promise((resolve, reject) => {
    const req = store.put(env);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete a global environment */
export async function deleteGlobalEnvironment(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ENV_STORE, 'readwrite');
  const store = tx.objectStore(ENV_STORE);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Save all global environments (bulk replace) */
export async function saveAllGlobalEnvironments(envs: Environment[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(ENV_STORE, 'readwrite');
  const store = tx.objectStore(ENV_STORE);
  // Clear and re-write all
  store.clear();
  envs.forEach(env => store.put(env));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
