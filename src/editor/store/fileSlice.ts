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
  updateSteps: (steps: TestStep[]) => void;
}

const defaultFile: TestFile = {
  version: '1.0',
  name: 'Untitled Test',
  tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
};

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

  setFile: (file) => set(state => {
    // Ensure tests exist
    if (!file.tests || file.tests.length === 0) {
      file = { ...file, tests: [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }] };
    }
    // Clamp activeTestIndex to valid range
    const activeTestIndex = Math.min(state.activeTestIndex, file.tests.length - 1);

    // Sync back to modules array so session state stays consistent
    const anyState = state as any;
    if (anyState.modules?.length > 0 && anyState.activeModuleIndex != null) {
      const modules = [...anyState.modules];
      const mi = anyState.activeModuleIndex;
      if (modules[mi]) {
        modules[mi] = { ...modules[mi], tests: file.tests, name: file.name || modules[mi].name };
        return { file, activeTestIndex, dirty: true, modules } as any;
      }
    }

    return { file, activeTestIndex, dirty: true };
  }),
  setFileId: (fileId) => set({ fileId }),
  setActiveTestIndex: (activeTestIndex) => set({ activeTestIndex }),
  setSavedFiles: (savedFiles) => set({ savedFiles }),
  setDirty: (dirty) => set({ dirty }),

  updateFileName: (name) => set(state => ({
    file: { ...state.file, name },
    dirty: true,
  })),

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
    return {
      file: { ...state.file, tests: [...tests, newTest] },
      activeTestIndex: tests.length,
      dirty: true,
    };
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
    return { file: { ...state.file, tests }, activeTestIndex, dirty: true };
  }),

  renameTest: (index, name) => set(state => {
    const tests = [...(state.file.tests || [])];
    tests[index] = { ...tests[index], name };
    return { file: { ...state.file, tests }, dirty: true };
  }),

  updateSteps: (steps) => set(state => {
    const tests = [...(state.file.tests || [])];
    tests[state.activeTestIndex] = { ...tests[state.activeTestIndex], steps };
    const file = { ...state.file, tests };

    // Sync back to modules
    const anyState = state as any;
    if (anyState.modules?.length > 0 && anyState.activeModuleIndex != null) {
      const modules = [...anyState.modules];
      const mi = anyState.activeModuleIndex;
      if (modules[mi]) {
        modules[mi] = { ...modules[mi], tests };
        return { file, dirty: true, modules } as any;
      }
    }

    return { file, dirty: true };
  }),
});
