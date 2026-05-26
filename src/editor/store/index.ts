import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import { FileSlice, createFileSlice } from './fileSlice';
import { EditorSlice, createEditorSlice } from './editorSlice';
import { ExecutionSlice, createExecutionSlice } from './executionSlice';
import { UISlice, createUISlice } from './uiSlice';

// ─── Combined Store ─────────────────────────────────────────────────────────

export type AppStore = FileSlice & EditorSlice & ExecutionSlice & UISlice;

export const useStore = create<AppStore>()(
  temporal(
    (...a) => ({
      ...createFileSlice(...a),
      ...createEditorSlice(...a),
      ...createExecutionSlice(...a),
      ...createUISlice(...a),
    }),
    {
      // Only track file/steps changes for undo/redo
      partialize: (state) => ({
        file: state.file,
        activeTestIndex: state.activeTestIndex,
      }),
      limit: 30,
    }
  )
);

// ─── Selectors (for performance — components only re-render on slice changes) ─

// File selectors
export const useFile = () => useStore(s => s.file);
export const useFileId = () => useStore(s => s.fileId);
export const useActiveTestIndex = () => useStore(s => s.activeTestIndex);
export const useSavedFiles = () => useStore(s => s.savedFiles);
export const useDirty = () => useStore(s => s.dirty);
export const useActiveTest = () => useStore(s => s.file.tests[s.activeTestIndex] || s.file.tests[0]);
export const useSteps = () => useStore(s => (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps);

// Editor selectors
export const useSelectedStepIds = () => useStore(s => s.selectedStepIds);
export const useBreakpoints = () => useStore(s => s.breakpoints);
export const useHighlightedStepId = () => useStore(s => s.highlightedStepId);

// Execution selectors
export const useRunState = () => useStore(s => s.runState);
export const useResults = () => useStore(s => s.results);
export const useNetworkLog = () => useStore(s => s.networkLog);
export const useConsoleLog = () => useStore(s => s.consoleLog);
export const useVariables = () => useStore(s => s.variables);
export const useScreenshots = () => useStore(s => s.screenshots);
export const useRunHistory = () => useStore(s => s.runHistory);
export const usePaused = () => useStore(s => s.paused);
export const useHeaded = () => useStore(s => s.headed);
export const useErrorMsg = () => useStore(s => s.errorMsg);

// UI selectors
export const useTab = () => useStore(s => s.tab);
export const useBottomTab = () => useStore(s => s.bottomTab);
export const useShowRunner = () => useStore(s => s.showRunner);
export const useShowRecordBar = () => useStore(s => s.showRecordBar);
export const useRecording = () => useStore(s => s.recording);
export const useCommandPaletteOpen = () => useStore(s => s.commandPaletteOpen);

// ─── Actions (stable references — never cause re-renders) ───────────────────

export const useFileActions = () => useStore(useShallow(s => ({
  setFile: s.setFile,
  setFileId: s.setFileId,
  setActiveTestIndex: s.setActiveTestIndex,
  setSavedFiles: s.setSavedFiles,
  setDirty: s.setDirty,
  updateFileName: s.updateFileName,
  loadFile: s.loadFile,
  newFile: s.newFile,
  addTest: s.addTest,
  deleteTest: s.deleteTest,
  updateSteps: s.updateSteps,
})));

export const useEditorActions = () => useStore(useShallow(s => ({
  selectStep: s.selectStep,
  selectAll: s.selectAll,
  clearSelection: s.clearSelection,
  toggleBreakpoint: s.toggleBreakpoint,
  setHighlightedStepId: s.setHighlightedStepId,
  setDraggedId: s.setDraggedId,
})));

export const useExecutionActions = () => useStore(useShallow(s => ({
  setRunState: s.setRunState,
  addResult: s.addResult,
  addScreenshot: s.addScreenshot,
  addNetworkEntry: s.addNetworkEntry,
  updateNetworkEntry: s.updateNetworkEntry,
  addConsoleEntry: s.addConsoleEntry,
  setVariable: s.setVariable,
  setErrorMsg: s.setErrorMsg,
  setRunHistory: s.setRunHistory,
  setPaused: s.setPaused,
  setHeaded: s.setHeaded,
  setRecordVideo: s.setRecordVideo,
  resetRun: s.resetRun,
})));

export const useUIActions = () => useStore(useShallow(s => ({
  setTab: s.setTab,
  setBottomTab: s.setBottomTab,
  setShowRunner: s.setShowRunner,
  toggleRunner: s.toggleRunner,
  setShowRecordBar: s.setShowRecordBar,
  toggleRecordBar: s.toggleRecordBar,
  setRecording: s.setRecording,
  setCommandPaletteOpen: s.setCommandPaletteOpen,
})));
