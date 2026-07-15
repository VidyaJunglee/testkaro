import { TestFile, TestCase, TestStep } from '../../schema';
import { StoredTestFile } from '../storage/db';
import { StateCreator } from 'zustand';

// ─── File Slice ─────────────────────────────────────────────────────────────
// Manages test files, active file, test cases, persistence

export interface FileSlice {
  // State
  file: TestFile;
  fileId: string;
  activeTestIndex: number;
  savedFiles: StoredTestFile[];
  dirty: boolean;

  // Computed
  activeTest: () => TestCase;

  // Actions
  setFile: (file: TestFile) => void;
  setFileId: (id: string) => void;
  setActiveTestIndex: (index: number) => void;
  setSavedFiles: (files: StoredTestFile[]) => void;
  setDirty: (dirty: boolean) => void;
  updateFileName: (name: string) => void;
  loadFile: (stored: StoredTestFile) => void;
  newFile: () => void;
  addTest: () => void;
  deleteTest: (index: number) => void;
  renameTest: (index: number, name: string) => void;
  setTestTags: (index: number, tags: string[]) => void;
  updateSteps: (steps: TestStep[]) => void;
  setModuleEngine: (engine: 'web' | 'mobile', mobileConfig?: TestFile['mobileConfig']) => void;
}

const defaultFile: TestFile = {
  version: '1.0',
  name: 'Untitled Test',
  tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
};

// Merge an updated file into modules[activeModuleIndex] so session state stays
// consistent — every file mutation must go through this or edits are lost when
// switching modules (module switch overwrites `file` from `modules`).
function withModuleSync(state: any, file: TestFile, extra: Record<string, unknown> = {}) {
  if (state.modules?.length > 0 && state.activeModuleIndex != null && state.modules[state.activeModuleIndex]) {
    const modules = [...state.modules];
    const mi = state.activeModuleIndex;
    modules[mi] = {
      ...modules[mi],
      tests: file.tests,
      name: file.name || modules[mi].name,
      engine: file.engine,
      mobileConfig: file.mobileConfig,
    };
    return { file, dirty: true, modules, ...extra };
  }
  return { file, dirty: true, ...extra };
}

export const createFileSlice: StateCreator<FileSlice, [], [], FileSlice> = (set, get) => ({
  file: defaultFile,
  fileId: crypto.randomUUID(),
  activeTestIndex: 0,
  savedFiles: [],
  dirty: false,

  activeTest: () => {
    const { file, activeTestIndex } = get();
    return file.tests[activeTestIndex] || file.tests[0];
  },

  setFile: (file) => {
    // Ensure tests exist
    if (!file.tests || file.tests.length === 0) {
      file = { ...file, tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }] };
    }

    const state = get() as any;
    // Clamp activeTestIndex to valid range
    const activeTestIndex = Math.min(state.activeTestIndex, file.tests.length - 1);

    set(withModuleSync(state, file, { activeTestIndex }) as any);
  },
  setFileId: (fileId) => set({ fileId }),
  setActiveTestIndex: (activeTestIndex) => set({ activeTestIndex }),
  setSavedFiles: (savedFiles) => set({ savedFiles }),
  setDirty: (dirty) => set({ dirty }),

  updateFileName: (name) => set(state => withModuleSync(state, { ...state.file, name }) as any),

  loadFile: (stored) => set({
    fileId: stored.id,
    file: {
      ...stored.file,
      tests: stored.file.tests?.length ? stored.file.tests : [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
    },
    activeTestIndex: 0,
    dirty: false,
  }),

  newFile: () => set({
    fileId: crypto.randomUUID(),
    file: { ...defaultFile, tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }] },
    activeTestIndex: 0,
    dirty: false,
  }),

  addTest: () => set(state => {
    const tests = state.file.tests || [];
    const newTest: TestCase = { id: crypto.randomUUID(), name: `Test ${tests.length + 1}`, steps: [] };
    const file = { ...state.file, tests: [...tests, newTest] };
    return withModuleSync(state, file, { activeTestIndex: tests.length }) as any;
  }),

  deleteTest: (index) => set(state => {
    const currentTests = state.file.tests || [];
    if (currentTests.length <= 1) return state;
    const tests = currentTests.filter((_, i) => i !== index);
    let activeTestIndex = state.activeTestIndex;
    if (index < activeTestIndex) {
      activeTestIndex--;
    } else if (index === activeTestIndex) {
      activeTestIndex = Math.min(activeTestIndex, tests.length - 1);
    }
    return withModuleSync(state, { ...state.file, tests }, { activeTestIndex }) as any;
  }),

  renameTest: (index, name) => set(state => {
    const tests = [...(state.file.tests || [])];
    tests[index] = { ...tests[index], name };
    return withModuleSync(state, { ...state.file, tests }) as any;
  }),

  setTestTags: (index, tags) => set(state => {
    const tests = [...(state.file.tests || [])];
    tests[index] = { ...tests[index], tags };
    return withModuleSync(state, { ...state.file, tests }) as any;
  }),

  updateSteps: (steps) => {
    const state = get() as any;
    const tests = [...(state.file.tests || [])];
    tests[state.activeTestIndex] = { ...tests[state.activeTestIndex], steps };
    set(withModuleSync(state, { ...state.file, tests }) as any);
  },

  setModuleEngine: (engine, mobileConfig) => set(state =>
    withModuleSync(state, { ...state.file, engine, mobileConfig }) as any
  ),
});
