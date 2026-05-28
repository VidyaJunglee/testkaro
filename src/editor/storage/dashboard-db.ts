// ─── Dashboard Metadata DB ──────────────────────────────────────────────────
// Small IndexedDB for storing dashboard-level metadata:
// - Recent projects (name, path, last opened, module/test counts)
// - Quick stats from last runs

const DB_NAME = 'testkaro-dashboard';
const DB_VERSION = 1;
const PROJECTS_STORE = 'recentProjects';

export interface RecentProject {
  id: string;
  name: string;
  path?: string; // filesystem path if using FS provider
  moduleCount: number;
  testCount: number;
  lastOpened: number;
  lastRunStatus?: 'passed' | 'failed' | 'mixed';
  lastRunTime?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        store.createIndex('lastOpened', 'lastOpened', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getRecentProjects(limit = 10): Promise<RecentProject[]> {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const store = tx.objectStore(PROJECTS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.index('lastOpened').getAll();
    req.onsuccess = () => resolve((req.result as RecentProject[]).reverse().slice(0, limit));
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecentProject(project: RecentProject): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.put(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removeRecentProject(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
