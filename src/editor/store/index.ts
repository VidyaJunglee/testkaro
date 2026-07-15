import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import { FileSlice, createFileSlice } from './fileSlice';
import { EditorSlice, createEditorSlice } from './editorSlice';
import { ExecutionSlice, createExecutionSlice } from './executionSlice';
import { UISlice, createUISlice } from './uiSlice';
import { SessionSlice, createSessionSlice } from './sessionSlice';
import { EnvSlice, createEnvSlice } from './envSlice';

// ─── Combined Store ─────────────────────────────────────────────────────────

export type AppStore = FileSlice & EditorSlice & ExecutionSlice & UISlice & SessionSlice & EnvSlice;

export const useStore = create<AppStore>()(
  temporal(
    (...a) => ({
      ...createFileSlice(...a),
      ...createEditorSlice(...a),
      ...createExecutionSlice(...a),
      ...createUISlice(...a),
      ...createSessionSlice(...a),
      ...createEnvSlice(...a),
    }),
    {
      // Track file/steps AND module-level state for undo/redo — restoring
      // modules alongside file also keeps them from diverging on undo
      partialize: (state) => ({
        file: state.file,
        activeTestIndex: state.activeTestIndex,
        modules: state.modules,
        activeModuleIndex: state.activeModuleIndex,
        manifest: state.manifest,
      }),
      limit: 30,
    }
  )
);

// ─── Selectors ───────────────────────────────────────────────────────────────

// File selectors
export const useFile = () => useStore(s => s.file);
export const useFileId = () => useStore(s => s.fileId);
export const useActiveTestIndex = () => useStore(s => s.activeTestIndex);
export const useSavedFiles = () => useStore(s => s.savedFiles);
export const useDirty = () => useStore(s => s.dirty);
const EMPTY_STEPS: never[] = [];
const DEFAULT_TEST = { id: '', name: 'Test 1', steps: EMPTY_STEPS };
export const useActiveTest = () => useStore(s => s.file.tests?.[s.activeTestIndex] || s.file.tests?.[0] || DEFAULT_TEST);
export const useSteps = () => useStore(s => (s.file.tests?.[s.activeTestIndex] || s.file.tests?.[0])?.steps || EMPTY_STEPS);

// Editor selectors
export const useSelectedStepIds = () => useStore(s => s.selectedStepIds);
export const useBreakpoints = () => useStore(s => s.breakpoints);
export const useHighlightedStepId = () => useStore(s => s.highlightedStepId);

// Execution selectors
export const useRunState = () => useStore(s => s.runState);
export const useRunMode = () => useStore(s => s.runMode);
export const useRunAllProgress = () => useStore(s => s.runAllProgress);
export const useResults = () => useStore(s => s.results);
export const useNetworkLog = () => useStore(s => s.networkLog);
export const useConsoleLog = () => useStore(s => s.consoleLog);
export const useVariables = () => useStore(s => s.variables);
export const useScreenshots = () => useStore(s => s.screenshots);
export const useRunHistory = () => useStore(s => s.runHistory);
export const usePaused = () => useStore(s => s.paused);
export const useHeaded = () => useStore(s => s.headed);
export const useBrowserType = () => useStore(s => s.browserType);
export const useErrorMsg = () => useStore(s => s.errorMsg);

// UI selectors
export const useTab = () => useStore(s => s.tab);
export const useBottomTab = () => useStore(s => s.bottomTab);
export const useViewLevel = () => useStore(s => s.viewLevel);
export const useShowRunner = () => useStore(s => s.showRunner);
export const useShowRecordBar = () => useStore(s => s.showRecordBar);
export const useRecording = () => useStore(s => s.recording);
export const useCommandPaletteOpen = () => useStore(s => s.commandPaletteOpen);
export const useActionPickerOpen = () => useStore(s => s.actionPickerOpen);
export const useEnvDrawerOpen = () => useStore(s => s.envDrawerOpen);
export const useDarkMode = () => useStore(s => s.darkMode);

// Session selectors
export const useCurrentAppId = () => useStore(s => s.currentAppId);
export const useLoadState = () => useStore(s => s.loadState);
export const useLoadError = () => useStore(s => s.loadError);
export const useProjectMode = () => useStore(s => s.projectMode);
export const useProjectName = () => useStore(s => s.projectName);
export const useManifest = () => useStore(s => s.manifest);
export const useModules = () => useStore(s => s.modules);
export const useActiveModuleIndex = () => useStore(s => s.activeModuleIndex);
export const useActiveModule = () => useStore(s => s.modules[s.activeModuleIndex] || null);

// ─── Actions (stable references) ────────────────────────────────────────────

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
  setTestTags: s.setTestTags,
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
  setRunMode: s.setRunMode,
  setRunAllProgress: s.setRunAllProgress,
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
  setBrowserType: s.setBrowserType,
  resetRun: s.resetRun,
})));

export const useUIActions = () => useStore(useShallow(s => ({
  setTab: s.setTab,
  setBottomTab: s.setBottomTab,
  setViewLevel: s.setViewLevel,
  setShowRunner: s.setShowRunner,
  toggleRunner: s.toggleRunner,
  setShowRecordBar: s.setShowRecordBar,
  toggleRecordBar: s.toggleRecordBar,
  setRecording: s.setRecording,
  setCommandPaletteOpen: s.setCommandPaletteOpen,
  setActionPickerOpen: s.setActionPickerOpen,
  setEnvDrawerOpen: s.setEnvDrawerOpen,
})));

export const useSessionActions = () => useStore(useShallow(s => ({
  loadApp: s.loadApp,
  unloadApp: s.unloadApp,
  switchModule: s.switchModule,
  addModule: s.addModule,
  deleteModule: s.deleteModule,
  renameModule: s.renameModule,
  setProjectName: s.setProjectName,
  persistApp: s.persistApp,
  linkFilesystem: s.linkFilesystem,
  unlinkFilesystem: s.unlinkFilesystem,
  importFromFilesystem: s.importFromFilesystem,
})));

export const useFsLinked = () => useStore(s => s.fsLinked);

// Environment selectors & actions
export const useEnvironments = () => useStore(s => s.environments);
export const useActiveEnvironmentId = () => useStore(s => s.activeEnvironmentId);
export const useActiveEnvironment = () => useStore(s => s.environments.find(e => e.id === s.activeEnvironmentId) || null);
export const useEnvActions = () => useStore(useShallow(s => ({
  addEnvironment: s.addEnvironment,
  deleteEnvironment: s.deleteEnvironment,
  renameEnvironment: s.renameEnvironment,
  setActiveEnvironment: s.setActiveEnvironment,
  setEnvVariable: s.setEnvVariable,
  deleteEnvVariable: s.deleteEnvVariable,
  setEnvironments: s.setEnvironments,
  resolveVariables: s.resolveVariables,
  getActiveVariables: s.getActiveVariables,
})));

// Global environment selectors
export const useGlobalEnvironments = () => useStore(s => s.globalEnvironments);
export const useActiveGlobalEnvironmentId = () => useStore(s => s.activeGlobalEnvironmentId);
export const useActiveGlobalEnvironment = () => useStore(s => s.globalEnvironments.find(e => e.id === s.activeGlobalEnvironmentId) || null);
export const useGlobalEnvActions = () => useStore(useShallow(s => ({
  setGlobalEnvironments: s.setGlobalEnvironments,
  setActiveGlobalEnvironment: s.setActiveGlobalEnvironment,
  addGlobalEnvironment: s.addGlobalEnvironment,
  deleteGlobalEnvironment: s.deleteGlobalEnvironment,
  renameGlobalEnvironment: s.renameGlobalEnvironment,
  setGlobalEnvVariable: s.setGlobalEnvVariable,
  deleteGlobalEnvVariable: s.deleteGlobalEnvVariable,
})));

// ─── Re-exports ──────────────────────────────────────────────────────────────
export type { ProjectMode, LoadState, SessionSlice } from './sessionSlice';
export type { RunMode } from './executionSlice';
export type { EditorTab, BottomTab, ViewLevel } from './uiSlice';
export type { EnvSlice } from './envSlice';
