import { ProjectProvider } from './types';
import { AppManifest, ModuleFile, TestFile } from '../../schema';
import { saveTestFile, getAllTestFiles, getTestFile, deleteTestFile, StoredTestFile } from '../storage/db';

// ─── IndexedDB Provider ─────────────────────────────────────────────────────
// Wraps existing IndexedDB storage to implement the ProjectProvider interface.
// This is the default provider until filesystem access is available.

export class IndexedDBProvider implements ProjectProvider {
  readonly name = 'indexeddb';

  // Project-level ops — not fully supported in flat mode, return null
  async openProject(): Promise<AppManifest | null> {
    return null; // IndexedDB stores flat files, not modular projects
  }

  async saveManifest(_manifest: AppManifest): Promise<void> {
    // No-op in flat mode — manifest is implicit from the file list
  }

  async exportProject(): Promise<{ manifest: AppManifest; modules: ModuleFile[] }> {
    const files = await getAllTestFiles();
    // Synthesize a manifest from existing flat files
    const manifest: AppManifest = {
      version: '1.0',
      name: 'Exported Project',
      modules: files.map(f => ({ id: f.id, folder: `${f.file.name}.tk.module` })),
    };
    const modules: ModuleFile[] = files.map((f, i) => ({
      id: f.id,
      name: f.file.name,
      order: i,
      tests: f.file.tests,
    }));
    return { manifest, modules };
  }

  // Module ops — map to individual files
  async loadModule(moduleId: string): Promise<ModuleFile | null> {
    const stored = await getTestFile(moduleId);
    if (!stored) return null;
    return {
      id: stored.id,
      name: stored.file.name,
      order: 0,
      tests: stored.file.tests,
      baseUrl: stored.file.baseUrl,
      description: stored.file.description,
    };
  }

  async saveModule(module: ModuleFile): Promise<void> {
    const file: TestFile = {
      version: '1.0',
      name: module.name,
      description: module.description,
      baseUrl: module.baseUrl,
      tests: module.tests,
    };
    await saveTestFile(module.id, file);
  }

  async deleteModule(moduleId: string): Promise<void> {
    await deleteTestFile(moduleId);
  }

  // Legacy flat-file ops — direct pass-through
  async loadLegacyFile(id: string): Promise<TestFile | null> {
    const stored = await getTestFile(id);
    return stored?.file ?? null;
  }

  async saveLegacyFile(id: string, file: TestFile): Promise<void> {
    await saveTestFile(id, file);
  }

  async listLegacyFiles(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
    const files = await getAllTestFiles();
    return files.map(f => ({ id: f.id, name: f.file.name, updatedAt: f.updatedAt }));
  }

  async deleteLegacyFile(id: string): Promise<void> {
    await deleteTestFile(id);
  }
}
