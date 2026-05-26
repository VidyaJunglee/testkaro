import { TestFile } from '../../schema';

const DB_NAME = 'testflow';
const DB_VERSION = 2;
const STORE_NAME = 'testfiles';
const RUNS_STORE = 'runs';

export interface StoredTestFile {
  id: string;
  file: TestFile;
  createdAt: number;
  updatedAt: number;
}

export interface StoredRun {
  id: string;
  fileId: string;
  testName: string;
  timestamp: number;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  results: any[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        const store = db.createObjectStore(RUNS_STORE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('fileId', 'fileId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function saveTestFile(id: string, file: TestFile): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'readwrite');
  const existing = await new Promise<StoredTestFile | undefined>(resolve => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
  const now = Date.now();
  const record: StoredTestFile = {
    id,
    file,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllTestFiles(): Promise<StoredTestFile[]> {
  const db = await openDB();
  const store = tx(db, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.index('updatedAt').getAll();
    req.onsuccess = () => resolve((req.result as StoredTestFile[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function getTestFile(id: string): Promise<StoredTestFile | undefined> {
  const db = await openDB();
  const store = tx(db, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTestFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Run History ───────────────────────────────────────────────────────────────

function runsTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(RUNS_STORE, mode).objectStore(RUNS_STORE);
}

export async function saveRun(run: StoredRun): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = runsTx(db, 'readwrite').put(run);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getRunHistory(limit = 50): Promise<StoredRun[]> {
  const db = await openDB();
  const store = runsTx(db, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.index('timestamp').getAll();
    req.onsuccess = () => resolve((req.result as StoredRun[]).reverse().slice(0, limit));
    req.onerror = () => reject(req.error);
  });
}

export async function getRunsForFile(fileId: string): Promise<StoredRun[]> {
  const db = await openDB();
  const store = runsTx(db, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.index('fileId').getAll(fileId);
    req.onsuccess = () => resolve((req.result as StoredRun[]).reverse());
    req.onerror = () => reject(req.error);
  });
}
