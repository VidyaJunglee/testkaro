import { StateCreator } from 'zustand';
import { NetworkEntry, ConsoleEntry } from '../engine';
import { StoredRun } from '../storage/db';

// ─── Execution Slice ────────────────────────────────────────────────────────
// Manages test run state, results, network, console, screenshots

export type RunState = 'idle' | 'connecting' | 'running' | 'done';

export interface StepResult {
  stepId: string;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface ExecutionSlice {
  // State
  runState: RunState;
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

  // Actions
  setRunState: (state: RunState) => void;
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
  resetRun: () => void;

  // Computed
  passedCount: () => number;
  failedCount: () => number;
  totalDuration: () => number;
}

export const createExecutionSlice: StateCreator<ExecutionSlice, [], [], ExecutionSlice> = (set, get) => ({
  runState: 'idle',
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

  setRunState: (runState) => set({ runState }),

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

  resetRun: () => set({
    results: [],
    networkLog: [],
    consoleLog: [],
    variables: {},
    screenshots: [],
    errorMsg: null,
    paused: false,
  }),

  passedCount: () => get().results.filter(r => r.status === 'passed').length,
  failedCount: () => get().results.filter(r => r.status === 'failed').length,
  totalDuration: () => get().results.reduce((sum, r) => sum + r.duration, 0),
});
