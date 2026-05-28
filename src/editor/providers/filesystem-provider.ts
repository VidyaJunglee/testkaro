import { ProjectProvider } from './types';
import { AppManifest, ModuleFile, TestFile } from '../../schema';

// ─── File System Access API Provider ─────────────────────────────────────────
// Uses the File System Access API (Chrome/Edge) to read/write .tk.app folders.
// Falls back to download/upload for unsupported browsers.

export class FileSystemProvider implements ProjectProvider {
  readonly name = 'filesystem';
  private rootHandle: FileSystemDirectoryHandle | null = null;

  /** Prompt user to select a .tk.app directory */
  async pickDirectory(): Promise<FileSystemDirectoryHandle> {
    // @ts-expect-error — showDirectoryPicker is not in TS lib yet
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    this.rootHandle = handle;
    return handle;
  }

  /** Set handle directly (e.g., from a stored reference) */
  setRootHandle(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle;
  }

  private ensureRoot(): FileSystemDirectoryHandle {
    if (!this.rootHandle) throw new Error('No directory selected. Call pickDirectory() first.');
    return this.rootHandle;
  }

  // ─── Project-level ──────────────────────────────────────────────────────────

  async openProject(): Promise<AppManifest | null> {
    const root = this.ensureRoot();
    try {
      const fileHandle = await root.getFileHandle('app.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as AppManifest;
    } catch {
      return null; // No app.json — might be a new project
    }
  }

  async saveManifest(manifest: AppManifest): Promise<void> {
    const root = this.ensureRoot();
    const fileHandle = await root.getFileHandle('app.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(manifest, null, 2));
    await writable.close();
  }

  async exportProject(): Promise<{ manifest: AppManifest; modules: ModuleFile[] }> {
    const manifest = await this.openProject();
    if (!manifest) throw new Error('No project found in directory');
    const modules: ModuleFile[] = [];
    for (const ref of manifest.modules) {
      const mod = await this.loadModule(ref.id);
      if (mod) modules.push(mod);
    }
    return { manifest, modules };
  }

  // ─── Module CRUD ────────────────────────────────────────────────────────────

  async loadModule(moduleId: string): Promise<ModuleFile | null> {
    const root = this.ensureRoot();
    // Find the module folder by iterating manifest refs or by convention
    try {
      // Convention: module folders are named {id}.tk.module/
      const moduleDir = await root.getDirectoryHandle(`${moduleId}.tk.module`);
      const fileHandle = await moduleDir.getFileHandle('module.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as ModuleFile;
    } catch {
      return null;
    }
  }

  async saveModule(module: ModuleFile): Promise<void> {
    const root = this.ensureRoot();
    const dirName = `${module.id}.tk.module`;
    const moduleDir = await root.getDirectoryHandle(dirName, { create: true });
    const fileHandle = await moduleDir.getFileHandle('module.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(module, null, 2));
    await writable.close();
  }

  async deleteModule(moduleId: string): Promise<void> {
    const root = this.ensureRoot();
    const dirName = `${moduleId}.tk.module`;
    try {
      await root.removeEntry(dirName, { recursive: true });
    } catch {
      // Directory may not exist
    }
  }

  // ─── Legacy single-file (not primary for FS provider, but supported) ────────

  async loadLegacyFile(id: string): Promise<TestFile | null> {
    const root = this.ensureRoot();
    try {
      const fileHandle = await root.getFileHandle(`${id}.tk.json`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as TestFile;
    } catch {
      return null;
    }
  }

  async saveLegacyFile(id: string, file: TestFile): Promise<void> {
    const root = this.ensureRoot();
    const fileHandle = await root.getFileHandle(`${id}.tk.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(file, null, 2));
    await writable.close();
  }

  async listLegacyFiles(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
    const root = this.ensureRoot();
    const results: Array<{ id: string; name: string; updatedAt: number }> = [];
    // @ts-expect-error — async iteration on directory handle
    for await (const [name, handle] of root.entries()) {
      if (name.endsWith('.tk.json') && handle.kind === 'file') {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          const text = await file.text();
          const parsed = JSON.parse(text) as TestFile;
          results.push({
            id: name.replace('.tk.json', ''),
            name: parsed.name,
            updatedAt: file.lastModified,
          });
        } catch { /* skip malformed files */ }
      }
    }
    return results;
  }

  async deleteLegacyFile(id: string): Promise<void> {
    const root = this.ensureRoot();
    try {
      await root.removeEntry(`${id}.tk.json`);
    } catch { /* file may not exist */ }
  }
}

/** Check if File System Access API is available */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}
