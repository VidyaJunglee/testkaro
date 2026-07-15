import { StateCreator } from 'zustand';
import { NetworkEntry, ConsoleEntry } from '../engine';
import { StoredRun } from '../storage/db';

// ─── Execution Slice ────────────────────────────────────────────────────────
// Manages test run state, results, network, console, screenshots

export type RunState = 'idle' | 'connecting' | 'running' | 'done';
export type RunMode = 'current' | 'module' | 'all' | 'all-modules';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface StepResult {
  stepId: string;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  startedAt: number;
  error?: string;
  screenshot?: string;
  testIndex?: number; // which test this result belongs to (for "run all" mode)
  moduleIndex?: number; // which module this result belongs to (for "all-modules" mode)
  moduleName?: string;
}

export interface RunAllProgress {
  currentTestIndex: number;
  totalTests: number;
  currentTestName: string;
  // Module-level progress (for all-modules mode)
  currentModuleIndex?: number;
  totalModules?: number;
  currentModuleName?: string;
}

export interface ExecutionSlice {
  // State
  runState: RunState;
  runMode: RunMode;
  runAllProgress: RunAllProgress | null;
  results: StepResult[];
  networkLog: NetworkEntry[];
  consoleLog: ConsoleEntry[];
  variables: Record<string, string>;
  screenshots: { label: string; data: string }[];
  errorMsg: string | null;
  runHistory: StoredRun[];
  paused: boolean;
  headed: boolean;
  recordVideo: boolean;
  browserType: BrowserType;

  // Actions
  setRunState: (state: RunState) => void;
  setRunMode: (mode: RunMode) => void;
  setRunAllProgress: (progress: RunAllProgress | null) => void;
  addResult: (result: StepResult) => void;
  addScreenshot: (screenshot: { label: string; data: string }) => void;
  addNetworkEntry: (entry: NetworkEntry) => void;
  updateNetworkEntry: (entry: Partial<NetworkEntry> & { id: string }) => void;
  addConsoleEntry: (entry: ConsoleEntry) => void;
  setVariable: (name: string, value: string) => void;
  setErrorMsg: (msg: string | null) => void;
  setRunHistory: (history: StoredRun[]) => void;
  setPaused: (paused: boolean) => void;
  setHeaded: (headed: boolean) => void;
  setRecordVideo: (record: boolean) => void;
  setBrowserType: (browserType: BrowserType) => void;
  resetRun: () => void;

  // Computed
  passedCount: () => number;
  failedCount: () => number;
  totalDuration: () => number;
}

export const createExecutionSlice: StateCreator<ExecutionSlice, [], [], ExecutionSlice> = (set, get) => ({
  runState: 'idle',
  runMode: 'current',
  runAllProgress: null,
  results: [],
  networkLog: [],
  consoleLog: [],
  variables: {},
  screenshots: [],
  errorMsg: null,
  runHistory: [],
  paused: false,
  headed: true,
  recordVideo: false,
  browserType: 'chromium',

  setRunState: (runState) => set({ runState }),
  setRunMode: (runMode) => set({ runMode }),
  setRunAllProgress: (runAllProgress) => set({ runAllProgress }),

  addResult: (result) => set(state => ({
    results: [...state.results, result],
    screenshots: result.screenshot
      ? [...state.screenshots, { label: `Step: ${result.type}`, data: result.screenshot }]
      : state.screenshots,
  })),

  addScreenshot: (screenshot) => set(state => ({
    screenshots: [...state.screenshots, screenshot],
  })),

  addNetworkEntry: (entry) => set(state => ({
    networkLog: [...state.networkLog, entry],
  })),

  updateNetworkEntry: (entry) => set(state => ({
    networkLog: state.networkLog.map(n => n.id === entry.id ? { ...n, ...entry } : n),
  })),

  addConsoleEntry: (entry) => set(state => ({
    consoleLog: [...state.consoleLog, entry],
  })),

  setVariable: (name, value) => set(state => ({
    variables: { ...state.variables, [name]: value },
  })),

  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setRunHistory: (runHistory) => set({ runHistory }),
  setPaused: (paused) => set({ paused }),
  setHeaded: (headed) => set({ headed }),
  setRecordVideo: (recordVideo) => set({ recordVideo }),
  setBrowserType: (browserType) => set({ browserType }),

  resetRun: () => set({
    results: [],
    networkLog: [],
    consoleLog: [],
    variables: {},
    screenshots: [],
    errorMsg: null,
    paused: false,
    runAllProgress: null,
  }),

  passedCount: () => get().results.filter(r => r.status === 'passed').length,
  failedCount: () => get().results.filter(r => r.status === 'failed').length,
  totalDuration: () => get().results.reduce((sum, r) => sum + r.duration, 0),
});
