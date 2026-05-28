// ─── Handle Store ────────────────────────────────────────────────────────────
// Stores FileSystemDirectoryHandle references in IndexedDB, keyed by app ID.
// IndexedDB can serialize structured-cloneable objects including FS handles.

const DB_NAME = 'testkaro-handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Store a directory handle for an app */
export async function saveHandle(appId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, appId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve a stored handle (may need permission re-grant) */
export async function getHandle(appId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(appId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a stored handle */
export async function removeHandle(appId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(appId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Check if we still have permission to use the handle */
export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    // @ts-expect-error — queryPermission not yet in TS lib
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    // @ts-expect-error
    const req = await handle.requestPermission({ mode: 'readwrite' });
    return req === 'granted';
  } catch {
    return false;
  }
}
