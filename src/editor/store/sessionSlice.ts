import { StateCreator } from 'zustand';
import { AppManifest, ModuleFile, TestFile } from '../../schema';
import { AppEntry, getApp, saveApp, generateAppId } from '../storage/app-registry';
import { getHandle, saveHandle, removeHandle, verifyPermission } from '../storage/handle-store';
import { writeAppToDirectory, readAppFromDirectory } from '../storage/filesystem-sync';
import { toast } from './toast';

// ─── Session Slice ──────────────────────────────────────────────────────────
// Single source of truth for the currently loaded app session.
// Manages: which app is loaded, its mode, modules, load lifecycle.
// The router drives navigation; this slice drives app state.

export type ProjectMode = 'modular';
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface SessionSlice {
  // ─── Session State ──────────────────────────────────────────────────────
  currentAppId: string | null;
  projectMode: ProjectMode;
  projectName: string;
  loadState: LoadState;
  loadError: string | null;

  // Modular state
  manifest: AppManifest | null;
  modules: ModuleFile[];
  activeModuleIndex: number;

  // ─── Session Lifecycle ──────────────────────────────────────────────────
  /** Load an app by ID from registry. Sets loadState, hydrates file state. */
  loadApp: (appId: string, moduleId?: string) => Promise<void>;
  /** Unload current app (go back to idle/dashboard). */
  unloadApp: () => void;

  // ─── Module Actions ─────────────────────────────────────────────────────
  setProjectMode: (mode: ProjectMode) => void;
  setProjectName: (name: string) => void;
  setManifest: (manifest: AppManifest) => void;
  setModules: (modules: ModuleFile[]) => void;
  setActiveModuleIndex: (index: number) => void;
  addModule: (name: string) => void;
  deleteModule: (index: number) => void;
  renameModule: (index: number, name: string) => void;
  reorderModules: (fromIndex: number, toIndex: number) => void;
  reorderTests: (moduleIndex: number, fromIndex: number, toIndex: number) => void;
  moveTestToModule: (fromModuleIndex: number, testIndex: number, toModuleIndex: number, toTestIndex: number) => void;

  /** Switch to a module by index and sync its tests into the file slice. */
  switchModule: (index: number) => void;

  /** Persist current state back to registry. Called by auto-save. */
  persistApp: () => Promise<void>;

  // ─── Filesystem Actions ──────────────────────────────────────────────────
  /** Whether current app is linked to a filesystem directory */
  fsLinked: boolean;
  /** Link current app to a filesystem directory (prompts picker) */
  linkFilesystem: () => Promise<void>;
  /** Unlink current app from filesystem */
  unlinkFilesystem: () => Promise<void>;
  /** Import a project from a filesystem directory into the registry */
  importFromFilesystem: () => Promise<string | null>;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set, get) => ({
  // Initial state: no app loaded
  currentAppId: null,
  projectMode: 'modular',
  projectName: '',
  loadState: 'idle',
  loadError: null,
  manifest: null,
  modules: [],
  activeModuleIndex: 0,
  fsLinked: false,

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  loadApp: async (appId, moduleId) => {
    set({ loadState: 'loading', loadError: null, currentAppId: appId });

    try {
      const app = await getApp(appId);
      if (!app) {
        set({ loadState: 'error', loadError: `App "${appId}" not found` });
        return;
      }

      // Hydrate session state — always modular
      const sessionState: Partial<SessionSlice> = {
        currentAppId: appId,
        projectName: app.name,
        projectMode: 'modular',
        loadState: 'ready',
        loadError: null,
      };

      // Check if linked to filesystem
      const handle = await getHandle(appId);
      (sessionState as any).fsLinked = !!handle;

      if (app.mode === 'modular' && app.manifest && app.modules) {
        sessionState.manifest = app.manifest;
        sessionState.modules = app.modules;

        // Resolve which module to activate
        let moduleIndex = 0;
        if (moduleId) {
          const idx = app.modules.findIndex(m => m.id === moduleId);
          if (idx >= 0) moduleIndex = idx;
        }
        sessionState.activeModuleIndex = moduleIndex;

        set(sessionState as any);

        // Sync active module's tests into file slice
        const mod = app.modules[moduleIndex];
        if (mod) {
          const store = get() as any;
          store.setFile?.({
            version: '1.0',
            name: mod.name,
            description: mod.description,
            baseUrl: mod.baseUrl,
            tests: mod.tests || [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
            engine: mod.engine,
            mobileConfig: mod.mobileConfig,
          });
          store.setFileId?.(appId);
          store.setActiveTestIndex?.(0);
          store.setDirty?.(false);
        }
      } else {
        // Legacy flat file — wrap into a single module
        const flatFile = app.file || { version: '1.0', name: app.name, tests: [] };
        const legacyModule: ModuleFile = {
          id: crypto.randomUUID(),
          name: flatFile.name || app.name || 'Module 1',
          order: 0,
          tests: flatFile.tests || [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
        };
        sessionState.manifest = { name: app.name, version: '1.0', modules: [{ id: legacyModule.id, folder: `${legacyModule.id}.tk.module` }] };
        sessionState.modules = [legacyModule];
        sessionState.activeModuleIndex = 0;

        set(sessionState as any);

        // Sync into file slice
        const store = get() as any;
        store.setFile?.({
          version: '1.0',
          name: legacyModule.name,
          tests: legacyModule.tests,
        });
        store.setFileId?.(appId);
        store.setActiveTestIndex?.(0);
        store.setDirty?.(false);
      }

      // Hydrate per-app environments from AppEntry
      const store = get() as any;
      store.setEnvironments?.(app.environments || []);
      store.setActiveEnvironment?.(app.activeEnvironmentId || null);
    } catch (e: any) {
      set({ loadState: 'error', loadError: e.message || 'Failed to load app' });
    }
  },

  unloadApp: () => set({
    currentAppId: null,
    projectMode: 'modular',
    projectName: '',
    loadState: 'idle',
    loadError: null,
    manifest: null,
    modules: [],
    activeModuleIndex: 0,
  }),

  // ─── Module Actions ─────────────────────────────────────────────────────

  setProjectMode: (projectMode) => set({ projectMode }),
  setProjectName: (projectName) => set(state => ({
    projectName,
    manifest: state.manifest ? { ...state.manifest, name: projectName } : null,
  })),
  setManifest: (manifest) => set({ manifest, projectName: manifest.name }),
  setModules: (modules) => set({ modules }),
  setActiveModuleIndex: (index) => set({ activeModuleIndex: index }),

  switchModule: (index) => {
    const state = get() as any;
    const mod = state.modules[index];
    if (!mod) return;

    // Write the outgoing file back into its module before swapping — any edit
    // that bypassed the synced fileSlice actions would otherwise be lost.
    const oldIdx = state.activeModuleIndex;
    if (oldIdx !== index && state.modules[oldIdx] && state.file) {
      const modules = [...state.modules];
      modules[oldIdx] = {
        ...modules[oldIdx],
        tests: state.file.tests,
        name: state.file.name || modules[oldIdx].name,
        engine: state.file.engine,
        mobileConfig: state.file.mobileConfig,
      };
      set({ modules, activeModuleIndex: index } as any);
    } else {
      set({ activeModuleIndex: index });
    }

    // Sync into file slice
    const store = get() as any;
    store.setFile?.({
      version: '1.0',
      name: mod.name,
      description: mod.description,
      baseUrl: mod.baseUrl,
      tests: mod.tests,
      engine: mod.engine,
      mobileConfig: mod.mobileConfig,
    });
    store.setActiveTestIndex?.(0);
  },

  addModule: (name) => set(state => {
    const newModule: ModuleFile = {
      id: crypto.randomUUID(),
      name,
      order: state.modules.length,
      tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
    };
    const modules = [...state.modules, newModule];
    const manifest = state.manifest ? {
      ...state.manifest,
      modules: [...state.manifest.modules, { id: newModule.id, folder: `${newModule.id}.tk.module` }],
    } : null;
    return { modules, manifest, activeModuleIndex: modules.length - 1 };
  }),

  deleteModule: (index) => set(state => {
    if (state.modules.length <= 1) return state;
    const modules = state.modules.filter((_, i) => i !== index);
    let activeModuleIndex = state.activeModuleIndex;
    if (index < activeModuleIndex) activeModuleIndex--;
    else if (index === activeModuleIndex) activeModuleIndex = Math.min(activeModuleIndex, modules.length - 1);
    const manifest = state.manifest ? {
      ...state.manifest,
      modules: state.manifest.modules.filter((_, i) => i !== index),
    } : null;
    return { modules, activeModuleIndex, manifest };
  }),

  renameModule: (index, name) => set(state => {
    const modules = [...state.modules];
    modules[index] = { ...modules[index], name };
    return { modules };
  }),

  reorderModules: (fromIndex, toIndex) => set(state => {
    const modules = [...state.modules];
    const [moved] = modules.splice(fromIndex, 1);
    modules.splice(toIndex, 0, moved);
    // Update activeModuleIndex to follow the active module
    let activeModuleIndex = state.activeModuleIndex;
    if (activeModuleIndex === fromIndex) activeModuleIndex = toIndex;
    else if (fromIndex < activeModuleIndex && toIndex >= activeModuleIndex) activeModuleIndex--;
    else if (fromIndex > activeModuleIndex && toIndex <= activeModuleIndex) activeModuleIndex++;
    return { modules, activeModuleIndex };
  }),

  reorderTests: (moduleIndex, fromIndex, toIndex) => set(state => {
    const modules = [...state.modules];
    const mod = { ...modules[moduleIndex], tests: [...(modules[moduleIndex].tests || [])] };
    const [moved] = mod.tests.splice(fromIndex, 1);
    mod.tests.splice(toIndex, 0, moved);
    modules[moduleIndex] = mod;
    // If reordering in active module, also sync file slice
    const store = get() as any;
    if (moduleIndex === state.activeModuleIndex) {
      store.setFile?.({ ...store.file, tests: mod.tests });
    }
    return { modules };
  }),

  moveTestToModule: (fromModuleIndex, testIndex, toModuleIndex, toTestIndex) => set(state => {
    const modules = [...state.modules];
    const fromMod = { ...modules[fromModuleIndex], tests: [...(modules[fromModuleIndex].tests || [])] };
    const toMod = fromModuleIndex === toModuleIndex ? fromMod : { ...modules[toModuleIndex], tests: [...(modules[toModuleIndex].tests || [])] };
    const [moved] = fromMod.tests.splice(testIndex, 1);
    toMod.tests.splice(toTestIndex, 0, moved);
    modules[fromModuleIndex] = fromMod;
    if (fromModuleIndex !== toModuleIndex) modules[toModuleIndex] = toMod;
    // Sync file slice if active module was affected
    const store = get() as any;
    if (state.activeModuleIndex === fromModuleIndex || state.activeModuleIndex === toModuleIndex) {
      const activeMod = modules[state.activeModuleIndex];
      store.setFile?.({ ...store.file, tests: activeMod.tests });
    }
    return { modules };
  }),

  // ─── Persistence ────────────────────────────────────────────────────────

  persistApp: async () => {
    const state = get() as any;
    const appId = state.currentAppId;
    if (!appId) return;

    const existing = await getApp(appId);
    if (!existing) return;

    if (existing.mode === 'flat') {
      // Upgrade legacy flat apps to modular on save
      existing.mode = 'modular';
      existing.manifest = state.manifest || { name: state.projectName, version: '1.0', modules: [] };
      existing.modules = state.modules.length > 0 ? [...state.modules] : [];
      if (existing.modules.length > 0) {
        existing.modules[state.activeModuleIndex] = {
          ...existing.modules[state.activeModuleIndex],
          tests: state.file?.tests || [],
          name: state.file?.name || existing.modules[state.activeModuleIndex].name,
          engine: state.file?.engine,
          mobileConfig: state.file?.mobileConfig,
        };
      }
      existing.file = undefined;
      existing.moduleCount = existing.modules.length;
      existing.testCount = existing.modules.reduce((sum: number, m: ModuleFile) => sum + (m.tests?.length || 0), 0);
    } else {
      // Sync current file state back into active module
      if (state.modules.length > 0) {
        const updatedModules = [...state.modules];
        updatedModules[state.activeModuleIndex] = {
          ...updatedModules[state.activeModuleIndex],
          tests: state.file?.tests || [],
          name: state.file?.name || updatedModules[state.activeModuleIndex].name,
          engine: state.file?.engine,
          mobileConfig: state.file?.mobileConfig,
        };
        existing.modules = updatedModules;
        existing.manifest = state.manifest || existing.manifest;
        existing.moduleCount = updatedModules.length;
        existing.testCount = updatedModules.reduce((sum: number, m: ModuleFile) => sum + m.tests.length, 0);
      }
    }

    existing.name = state.projectName || existing.name;
    existing.environments = state.environments || [];
    existing.activeEnvironmentId = state.activeEnvironmentId || null;
    existing.updatedAt = Date.now();
    await saveApp(existing);
    state.setDirty?.(false);

    // Sync to filesystem if linked
    if (state.fsLinked) {
      try {
        const handle = await getHandle(appId);
        if (handle && await verifyPermission(handle)) {
          await writeAppToDirectory(existing, handle);
        }
      } catch {
        // Data is still safe in IndexedDB — just tell the user the fs mirror is stale.
        toast.error('Failed to sync changes to linked filesystem folder');
      }
    }
  },

  // ─── Filesystem Actions ──────────────────────────────────────────────────

  linkFilesystem: async () => {
    const state = get();
    const appId = state.currentAppId;
    if (!appId) return;

    try {
      // @ts-expect-error — showDirectoryPicker not in TS lib
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveHandle(appId, handle);
      set({ fsLinked: true });

      // Write current state to the selected directory immediately
      const app = await getApp(appId);
      if (app) {
        await writeAppToDirectory(app, handle);
      }
    } catch {
      // User cancelled or API not supported
    }
  },

  unlinkFilesystem: async () => {
    const state = get();
    const appId = state.currentAppId;
    if (!appId) return;

    await removeHandle(appId);
    set({ fsLinked: false });
  },

  importFromFilesystem: async () => {
    try {
      // @ts-expect-error — showDirectoryPicker not in TS lib
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const appId = generateAppId(handle.name || 'imported');
      const app = await readAppFromDirectory(handle, appId);
      if (!app) return null;

      await saveApp(app);
      await saveHandle(appId, handle);
      return appId;
    } catch {
      return null;
    }
  },
});
