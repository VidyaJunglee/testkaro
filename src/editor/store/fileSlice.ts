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

  setFile: (file) => set({ file }),
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
    file: stored.file,
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
    const newTest: TestCase = { id: crypto.randomUUID(), name: `Test ${state.file.tests.length + 1}`, steps: [] };
    return {
      file: { ...state.file, tests: [...state.file.tests, newTest] },
      activeTestIndex: state.file.tests.length,
      dirty: true,
    };
  }),

  deleteTest: (index) => set(state => {
    if (state.file.tests.length <= 1) return state;
    return {
      file: { ...state.file, tests: state.file.tests.filter((_, i) => i !== index) },
      activeTestIndex: Math.min(state.activeTestIndex, state.file.tests.length - 2),
      dirty: true,
    };
  }),

  updateSteps: (steps) => set(state => {
    const tests = [...state.file.tests];
    tests[state.activeTestIndex] = { ...tests[state.activeTestIndex], steps };
    return { file: { ...state.file, tests }, dirty: true };
  }),
});
