import { StateCreator } from 'zustand';

// ─── UI Slice ───────────────────────────────────────────────────────────────
// Manages UI state: tabs, panels, modals, recording
// Navigation is handled by the router (not stored here).

export type EditorTab = 'visual' | 'json';
export type BottomTab = 'results' | 'timeline' | 'network' | 'console' | 'variables' | 'screenshots' | 'history';
export type ViewLevel = 'module' | 'test';

export interface UISlice {
  // State
  tab: EditorTab;
  bottomTab: BottomTab;
  viewLevel: ViewLevel;
  showRunner: boolean;
  showRecordBar: boolean;
  recording: boolean;
  commandPaletteOpen: boolean;
  actionPickerOpen: boolean;
  envDrawerOpen: boolean;
  darkMode: boolean;

  // Actions
  setTab: (tab: EditorTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setViewLevel: (level: ViewLevel) => void;
  setShowRunner: (show: boolean) => void;
  toggleRunner: () => void;
  setShowRecordBar: (show: boolean) => void;
  toggleRecordBar: () => void;
  setRecording: (recording: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActionPickerOpen: (open: boolean) => void;
  setEnvDrawerOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  tab: 'visual',
  bottomTab: 'timeline',
  viewLevel: 'module',
  showRunner: false,
  showRecordBar: false,
  recording: false,
  commandPaletteOpen: false,
  actionPickerOpen: false,
  envDrawerOpen: false,
  darkMode: localStorage.getItem('testkaro-dark') !== 'false',

  setTab: (tab) => set({ tab }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  setViewLevel: (viewLevel) => set({ viewLevel }),
  setShowRunner: (showRunner) => set({ showRunner }),
  toggleRunner: () => set(state => ({ showRunner: !state.showRunner })),
  setShowRecordBar: (showRecordBar) => set({ showRecordBar }),
  toggleRecordBar: () => set(state => ({ showRecordBar: !state.showRecordBar })),
  setRecording: (recording) => set({ recording }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setActionPickerOpen: (actionPickerOpen) => set({ actionPickerOpen }),
  setEnvDrawerOpen: (envDrawerOpen) => set({ envDrawerOpen }),
  toggleDarkMode: () => set(state => {
    const next = !state.darkMode;
    localStorage.setItem('testkaro-dark', String(next));
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return { darkMode: next };
  }),
});
