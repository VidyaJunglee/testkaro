// ─── Filesystem Sync ─────────────────────────────────────────────────────────
// Bidirectional sync between AppEntry (in-memory/IndexedDB) and filesystem directory.
// Write: AppEntry → directory (app.json + module folders or flat .tk.json)
// Read: directory → AppEntry

import { AppManifest, ModuleFile, TestFile } from '../../schema';
import { AppEntry, AppMode } from './app-registry';

// ─── Write to Filesystem ─────────────────────────────────────────────────────

/** Write an AppEntry to a filesystem directory */
export async function writeAppToDirectory(
  app: AppEntry,
  root: FileSystemDirectoryHandle
): Promise<void> {
  if (app.mode === 'modular') {
    await writeModularApp(app, root);
  } else {
    await writeFlatApp(app, root);
  }
}

async function writeFlatApp(app: AppEntry, root: FileSystemDirectoryHandle): Promise<void> {
  if (!app.file) return;

  // Write as app.json with a wrapper indicating flat mode
  const wrapper = {
    _testkaro: { version: '1.0', mode: 'flat' as const },
    ...app.file,
  };
  await writeJSON(root, 'app.json', wrapper);
}

async function writeModularApp(app: AppEntry, root: FileSystemDirectoryHandle): Promise<void> {
  if (!app.manifest) return;

  // Write manifest
  const manifestData = {
    _testkaro: { version: '1.0', mode: 'modular' as const },
    ...app.manifest,
  };
  await writeJSON(root, 'app.json', manifestData);

  // Write each module
  if (app.modules) {
    for (const mod of app.modules) {
      const dirName = `${mod.id}.tk.module`;
      const moduleDir = await root.getDirectoryHandle(dirName, { create: true });
      await writeJSON(moduleDir, 'module.json', mod);
    }
  }

  // Clean up orphaned module directories
  await cleanOrphanedModules(root, app.modules || []);
}

async function cleanOrphanedModules(
  root: FileSystemDirectoryHandle,
  modules: ModuleFile[]
): Promise<void> {
  const validDirs = new Set(modules.map(m => `${m.id}.tk.module`));
  const toDelete: string[] = [];

  // @ts-expect-error — async iteration
  for await (const [name, handle] of root.entries()) {
    if (name.endsWith('.tk.module') && handle.kind === 'directory' && !validDirs.has(name)) {
      toDelete.push(name);
    }
  }

  for (const dir of toDelete) {
    try { await root.removeEntry(dir, { recursive: true }); } catch { /* ignore */ }
  }
}

// ─── Read from Filesystem ────────────────────────────────────────────────────

/** Read a directory into an AppEntry (for import) */
export async function readAppFromDirectory(
  root: FileSystemDirectoryHandle,
  appId: string
): Promise<AppEntry | null> {
  try {
    const fileHandle = await root.getFileHandle('app.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);

    const mode: AppMode = data._testkaro?.mode || detectMode(data);
    const now = Date.now();

    if (mode === 'modular') {
      return readModularApp(root, data, appId, now);
    } else {
      return readFlatApp(data, appId, root.name, now);
    }
  } catch {
    // No app.json — try to find .tk.json files (legacy flat)
    return readLegacyDirectory(root, appId);
  }
}

function detectMode(data: any): AppMode {
  return Array.isArray(data.modules) ? 'modular' : 'flat';
}

function readFlatApp(data: any, appId: string, dirName: string, now: number): AppEntry {
  // Strip _testkaro wrapper
  const { _testkaro, ...fileData } = data;
  const testFile: TestFile = {
    version: fileData.version || '1.0',
    name: fileData.name || dirName,
    description: fileData.description,
    baseUrl: fileData.baseUrl,
    variables: fileData.variables,
    tests: fileData.tests || [],
  };

  return {
    id: appId,
    name: testFile.name,
    mode: 'flat',
    createdAt: now,
    updatedAt: now,
    file: testFile,
    testCount: testFile.tests.length,
    moduleCount: 0,
    lastRunStatus: 'never',
  };
}

async function readModularApp(
  root: FileSystemDirectoryHandle,
  data: any,
  appId: string,
  now: number
): Promise<AppEntry> {
  const { _testkaro, ...manifestData } = data;
  const manifest: AppManifest = {
    version: manifestData.version || '1.0',
    name: manifestData.name || root.name,
    description: manifestData.description,
    baseUrl: manifestData.baseUrl,
    variables: manifestData.variables,
    modules: manifestData.modules || [],
  };

  // Load all modules
  const modules: ModuleFile[] = [];
  for (const ref of manifest.modules) {
    try {
      const moduleDir = await root.getDirectoryHandle(`${ref.id}.tk.module`);
      const fh = await moduleDir.getFileHandle('module.json');
      const f = await fh.getFile();
      const mod = JSON.parse(await f.text()) as ModuleFile;
      modules.push(mod);
    } catch {
      // Module dir missing — skip
    }
  }

  return {
    id: appId,
    name: manifest.name,
    mode: 'modular',
    createdAt: now,
    updatedAt: now,
    manifest,
    modules,
    testCount: modules.reduce((sum, m) => sum + m.tests.length, 0),
    moduleCount: modules.length,
    lastRunStatus: 'never',
  };
}

async function readLegacyDirectory(
  root: FileSystemDirectoryHandle,
  appId: string
): Promise<AppEntry | null> {
  // Look for any .tk.json files
  let found: TestFile | null = null;
  // @ts-expect-error — async iteration
  for await (const [name, handle] of root.entries()) {
    if (name.endsWith('.tk.json') && handle.kind === 'file') {
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        found = JSON.parse(await file.text()) as TestFile;
        break; // Use first found
      } catch { /* skip */ }
    }
  }

  if (!found) return null;

  const now = Date.now();
  return {
    id: appId,
    name: found.name || root.name,
    mode: 'flat',
    createdAt: now,
    updatedAt: now,
    file: found,
    testCount: found.tests.length,
    moduleCount: 0,
    lastRunStatus: 'never',
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

async function writeJSON(dir: FileSystemDirectoryHandle, filename: string, data: unknown): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}
