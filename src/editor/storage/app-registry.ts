// ─── App Registry ────────────────────────────────────────────────────────────
// Production-ready IndexedDB storage for registered TestKaro apps.
// Each app has a unique ID, metadata, and either flat-file or modular data.

import { TestFile, AppManifest, ModuleFile, Environment } from '../../schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppMode = 'flat' | 'modular';

export interface AppEntry {
  id: string;
  name: string;
  mode: AppMode;
  createdAt: number;
  updatedAt: number;
  description?: string;
  baseUrl?: string;

  // Flat mode data
  file?: TestFile;

  // Modular mode data
  manifest?: AppManifest;
  modules?: ModuleFile[];

  // Environments
  environments?: Environment[];
  activeEnvironmentId?: string;

  // Metadata
  testCount: number;
  moduleCount: number;
  lastRunStatus?: 'passed' | 'failed' | 'mixed' | 'never';
  lastRunAt?: number;
}

export interface AppSummary {
  id: string;
  name: string;
  mode: AppMode;
  createdAt: number;
  updatedAt: number;
  testCount: number;
  moduleCount: number;
  lastRunStatus?: 'passed' | 'failed' | 'mixed' | 'never';
}

// ─── Database ────────────────────────────────────────────────────────────────

const DB_NAME = 'testkaro-registry';
const DB_VERSION = 1;
const APPS_STORE = 'apps';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(APPS_STORE)) {
        const store = db.createObjectStore(APPS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/** Get all apps as summaries (lightweight, no file data) */
export async function listApps(): Promise<AppSummary[]> {
  const db = await openDB();
  const tx = db.transaction(APPS_STORE, 'readonly');
  const store = tx.objectStore(APPS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.index('updatedAt').getAll();
    req.onsuccess = () => {
      const entries = (req.result as AppEntry[]).reverse();
      resolve(entries.map(e => ({
        id: e.id,
        name: e.name,
        mode: e.mode,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        testCount: e.testCount,
        moduleCount: e.moduleCount,
        lastRunStatus: e.lastRunStatus,
      })));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get a full app by ID (includes file/module data) */
export async function getApp(id: string): Promise<AppEntry | null> {
  const db = await openDB();
  const tx = db.transaction(APPS_STORE, 'readonly');
  const store = tx.objectStore(APPS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Save (create or update) an app */
export async function saveApp(app: AppEntry): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(APPS_STORE, 'readwrite');
  const store = tx.objectStore(APPS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.put(app);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete an app by ID */
export async function deleteApp(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(APPS_STORE, 'readwrite');
  const store = tx.objectStore(APPS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Check if an app exists */
export async function appExists(id: string): Promise<boolean> {
  const app = await getApp(id);
  return app !== null;
}

// ─── Helper: Create new app ──────────────────────────────────────────────────

export function createFlatApp(name: string): AppEntry {
  const id = generateAppId(name);
  const now = Date.now();
  return {
    id,
    name,
    mode: 'flat',
    createdAt: now,
    updatedAt: now,
    file: {
      version: '1.0',
      name,
      tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
    },
    testCount: 1,
    moduleCount: 0,
    lastRunStatus: 'never',
  };
}

export function createModularApp(name: string): AppEntry {
  const id = generateAppId(name);
  const now = Date.now();
  const moduleId = crypto.randomUUID();
  return {
    id,
    name,
    mode: 'modular',
    createdAt: now,
    updatedAt: now,
    manifest: {
      version: '1.0',
      name,
      modules: [{ id: moduleId, folder: `${moduleId}.tk.module` }],
    },
    modules: [{
      id: moduleId,
      name: 'Module 1',
      order: 0,
      tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
    }],
    testCount: 1,
    moduleCount: 1,
    lastRunStatus: 'never',
  };
}

/** Generate a URL-safe app ID from name */
export function generateAppId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const suffix = Date.now().toString(36).slice(-4);
  return slug ? `${slug}-${suffix}` : suffix;
}
