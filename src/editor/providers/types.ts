import { AppManifest, ModuleFile, TestFile } from '../../schema';

// ─── Provider Abstraction ────────────────────────────────────────────────────
// Swap between filesystem, IndexedDB, or future server by implementing this interface.

export interface ProjectProvider {
  /** Human-readable provider name (e.g., "filesystem", "indexeddb", "server") */
  readonly name: string;

  // ─── Project-level ──────────────────────────────────────────────────────────

  /** Open an existing project — returns manifest or null if not found */
  openProject(): Promise<AppManifest | null>;

  /** Save/update the project manifest */
  saveManifest(manifest: AppManifest): Promise<void>;

  /** Export the entire project as a single JSON blob (for download) */
  exportProject(): Promise<{ manifest: AppManifest; modules: ModuleFile[] }>;

  // ─── Module CRUD ────────────────────────────────────────────────────────────

  /** Load a module's full data (tests + metadata) */
  loadModule(moduleId: string): Promise<ModuleFile | null>;

  /** Save a module (create or update) */
  saveModule(module: ModuleFile): Promise<void>;

  /** Delete a module entirely */
  deleteModule(moduleId: string): Promise<void>;

  // ─── Legacy single-file ─────────────────────────────────────────────────────
  // For backward compat with flat TestFile format (no modules)

  /** Load a legacy single-file test */
  loadLegacyFile(id: string): Promise<TestFile | null>;

  /** Save a legacy single-file test */
  saveLegacyFile(id: string, file: TestFile): Promise<void>;

  /** List all legacy files */
  listLegacyFiles(): Promise<Array<{ id: string; name: string; updatedAt: number }>>;

  /** Delete a legacy file */
  deleteLegacyFile(id: string): Promise<void>;
}

/**
 * Currently active provider instance.
 * Set at app startup via `setProvider()`.
 */
let _provider: ProjectProvider | null = null;

export function getProvider(): ProjectProvider {
  if (!_provider) throw new Error('No ProjectProvider set. Call setProvider() at startup.');
  return _provider;
}

export function setProvider(provider: ProjectProvider): void {
  _provider = provider;
}
