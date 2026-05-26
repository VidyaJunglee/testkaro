import { StateCreator } from 'zustand';

// ─── UI Slice ───────────────────────────────────────────────────────────────
// Manages UI state: tabs, panels, modals, recording

export type EditorTab = 'visual' | 'json';
export type BottomTab = 'results' | 'timeline' | 'network' | 'console' | 'variables' | 'screenshots' | 'history';

export interface UISlice {
  // State
  tab: EditorTab;
  bottomTab: BottomTab;
  showRunner: boolean;
  showRecordBar: boolean;
  recording: boolean;
  commandPaletteOpen: boolean;
  darkMode: boolean;

  // Actions
  setTab: (tab: EditorTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setShowRunner: (show: boolean) => void;
  toggleRunner: () => void;
  setShowRecordBar: (show: boolean) => void;
  toggleRecordBar: () => void;
  setRecording: (recording: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  tab: 'visual',
  bottomTab: 'results',
  showRunner: false,
  showRecordBar: false,
  recording: false,
  commandPaletteOpen: false,
  darkMode: localStorage.getItem('testkaro-dark') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches,

  setTab: (tab) => set({ tab }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  setShowRunner: (showRunner) => set({ showRunner }),
  toggleRunner: () => set(state => ({ showRunner: !state.showRunner })),
  setShowRecordBar: (showRecordBar) => set({ showRecordBar }),
  toggleRecordBar: () => set(state => ({ showRecordBar: !state.showRecordBar })),
  setRecording: (recording) => set({ recording }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleDarkMode: () => set(state => {
    const next = !state.darkMode;
    localStorage.setItem('testkaro-dark', String(next));
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return { darkMode: next };
  }),
});
