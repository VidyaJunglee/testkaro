import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useStore as useZustandStore } from 'zustand';
import { TestStep } from '../schema';
import { VisualBuilder } from './components/VisualBuilder';
import { JsonEditor } from './components/JsonEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { RecordBar } from './components/RecordBar';
import { CommandPalette } from './components/CommandPalette';
import { BLOCKS } from './blocks';
import { saveTestFile, getAllTestFiles, deleteTestFile } from './storage/db';
import {
  useStore,
  useFile, useFileId, useActiveTestIndex, useSavedFiles, useDirty,
  useActiveTest, useSteps,
  useHighlightedStepId, useBreakpoints,
  useTab, useShowRunner, useShowRecordBar, useRecording, useCommandPaletteOpen, useDarkMode,
} from './store';
import {
  Circle, FileText, Plus, Trash2, Command, Code2, Layers,
  PanelRightOpen, PanelRightClose, Undo2, Redo2, Moon, Sun,
} from 'lucide-react';

export function App() {
  const file = useFile();
  const fileId = useFileId();
  const activeTestIndex = useActiveTestIndex();
  const savedFiles = useSavedFiles();
  const dirty = useDirty();
  const activeTest = useActiveTest();
  const tab = useTab();
  const showRunner = useShowRunner();
  const showRecordBar = useShowRecordBar();
  const recording = useRecording();
  const commandPaletteOpen = useCommandPaletteOpen();
  const highlightedStepId = useHighlightedStepId();
  const breakpoints = useBreakpoints();
  const darkMode = useDarkMode();

  // Actions (stable references)
  const store = useStore;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply dark class on mount
  useEffect(() => {
    if (store.getState().darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Panel widths (custom resize)
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [runnerWidth, setRunnerWidth] = useState(420);

  const handleSidebarResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      setSidebarWidth(Math.max(140, Math.min(360, startWidth + delta)));
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [sidebarWidth]);

  const handleRunnerResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = runnerWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX;
      setRunnerWidth(Math.max(280, Math.min(700, startWidth + delta)));
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [runnerWidth]);

  // Temporal (undo/redo)
  const canUndo = useZustandStore(useStore.temporal, s => s.pastStates.length > 0);
  const canRedo = useZustandStore(useStore.temporal, s => s.futureStates.length > 0);
  const undo = useZustandStore(useStore.temporal, s => s.undo);
  const redo = useZustandStore(useStore.temporal, s => s.redo);

  // Load saved files on mount
  useEffect(() => {
    getAllTestFiles().then(files => store.getState().setSavedFiles(files));
  }, []);

  // Auto-save debounced
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTestFile(fileId, file).then(() => {
        getAllTestFiles().then(files => store.getState().setSavedFiles(files));
        store.getState().setDirty(false);
      });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [file, fileId]);

  const handleStepRecorded = useCallback((step: TestStep) => {
    const state = store.getState();
    const currentSteps = state.file.tests[state.activeTestIndex]?.steps || [];
    state.updateSteps([...currentSteps, step]);
  }, []);

  const handleAddBlock = useCallback((blockType: string) => {
    const block = BLOCKS.find(b => b.type === blockType);
    if (!block) return;
    const params: Record<string, unknown> = {};
    block.inputs.forEach(input => {
      params[input.name] = input.default !== undefined ? input.default : '';
    });
    const state = store.getState();
    const currentSteps = state.file.tests[state.activeTestIndex]?.steps || [];
    state.updateSteps([...currentSteps, { id: crypto.randomUUID(), type: blockType, params }]);
  }, []);

  const handleDeleteFile = useCallback(async (id: string) => {
    await deleteTestFile(id);
    const updated = await getAllTestFiles();
    store.getState().setSavedFiles(updated);
    if (id === store.getState().fileId) store.getState().newFile();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = store.getState();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); s.setCommandPaletteOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); s.newFile(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); s.setShowRunner(true); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') { e.preventDefault(); s.setShowRecordBar(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between h-12 px-4 bg-bg-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-accent to-blue-700 rounded flex items-center justify-center">
              <Layers size={11} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text-primary tracking-tight">TestKaro</span>
          </div>

          {/* File name */}
          <div className="flex items-center gap-1.5 ml-2">
            <input
              className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-active focus:bg-bg-input text-text-secondary focus:text-text-primary px-2 py-1 rounded text-sm w-44 outline-none transition-all"
              value={file.name}
              onChange={e => store.getState().updateFileName(e.target.value)}
            />
            {dirty && <div className="w-1.5 h-1.5 bg-warning rounded-full" title="Unsaved" />}
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center bg-bg-primary rounded-lg p-0.5 border border-border-subtle">
          <button
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'visual' ? 'bg-bg-card text-text-primary shadow-sm border border-border-subtle' : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => store.getState().setTab('visual')}
          >
            <Layers size={12} />
            Visual
          </button>
          <button
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'json' ? 'bg-bg-card text-text-primary shadow-sm border border-border-subtle' : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => store.getState().setTab('json')}
          >
            <Code2 size={12} />
            JSON
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <button
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-default"
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-default"
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Dark mode toggle */}
          <button
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
            onClick={() => store.getState().toggleDarkMode()}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
            onClick={() => store.getState().setCommandPaletteOpen(true)}
            title="Command palette (Cmd+K)"
          >
            <Command size={12} />
            <kbd className="text-[10px] px-1 py-0.5 bg-bg-tertiary rounded border border-border-subtle">K</kbd>
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              showRecordBar || recording
                ? 'bg-danger/10 text-danger'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
            onClick={() => store.getState().toggleRecordBar()}
            title="Record (Cmd+Shift+R)"
          >
            <Circle size={10} className={recording ? 'fill-danger text-danger animate-pulse' : ''} />
            Record
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              showRunner
                ? 'bg-accent text-white'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            }`}
            onClick={() => store.getState().toggleRunner()}
          >
            {showRunner ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
            {showRunner ? 'Hide' : 'Run'}
          </button>
        </div>
      </header>

      {/* Record bar */}
      {showRecordBar && (
        <RecordBar
          onStepRecorded={handleStepRecorded}
          onRecordingStateChange={(r) => store.getState().setRecording(r)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <aside style={{ width: sidebarWidth }} className="h-full bg-bg-secondary border-r border-border flex flex-col shrink-0">
          {/* Files */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold">Files</span>
            <button
              className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
              onClick={() => store.getState().newFile()} title="New file"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-36 border-b border-border">
            {savedFiles.map(sf => (
              <div
                key={sf.id}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs transition-all ${
                  sf.id === fileId
                    ? 'bg-accent/8 text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-bg-hover'
                }`}
                onClick={() => store.getState().loadFile(sf)}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileText size={11} className="text-text-tertiary shrink-0" />
                  <span className="truncate">{sf.file.name}</span>
                </div>
                <button
                  className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all"
                  onClick={e => { e.stopPropagation(); handleDeleteFile(sf.id); }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {savedFiles.length === 0 && (
              <p className="px-3 py-2 text-xs text-text-tertiary">No saved files</p>
            )}
          </div>

          {/* Tests */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold">Tests</span>
            <button
              className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
              onClick={() => store.getState().addTest()} title="Add test"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {file.tests.map((t, i) => (
              <div
                key={t.id}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer border-l-2 text-xs transition-all ${
                  i === activeTestIndex
                    ? 'border-l-accent bg-accent/5 text-text-primary font-medium'
                    : 'border-l-transparent text-text-secondary hover:bg-bg-hover'
                }`}
                onClick={() => store.getState().setActiveTestIndex(i)}
              >
                <span className="truncate">{t.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-tertiary">{t.steps.length}</span>
                  {file.tests.length > 1 && (
                    <button
                      className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-all"
                      onClick={e => { e.stopPropagation(); store.getState().deleteTest(i); }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border text-[10px] text-text-tertiary">
            {activeTest.steps.length} step{activeTest.steps.length !== 1 ? 's' : ''} &middot; auto-saved
          </div>
        </aside>

        {/* Sidebar resize handle */}
        <div
          className="w-1.5 cursor-col-resize bg-transparent hover:bg-accent/50 active:bg-accent transition-colors shrink-0 relative z-10"
          onPointerDown={handleSidebarResize}
        />

        {/* Editor */}
        <div className="flex-1 min-w-0 h-full relative">
          <div className={`absolute inset-0 ${tab === 'visual' ? '' : 'invisible'}`}>
            <VisualBuilder />
          </div>
          <div className={`absolute inset-0 ${tab === 'json' ? '' : 'invisible'}`}>
            <JsonEditor file={file} onChange={(f) => store.getState().setFile(f)} />
          </div>
        </div>

        {/* Runner */}
        {showRunner && (
          <>
            {/* Runner resize handle */}
            <div
              className="w-1.5 cursor-col-resize bg-transparent hover:bg-accent/50 active:bg-accent transition-colors shrink-0 relative z-10"
              onPointerDown={handleRunnerResize}
            />
            <div style={{ width: runnerWidth }} className="h-full shrink-0">
              <ExecutionPanel />
            </div>
          </>
        )}
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => store.getState().setCommandPaletteOpen(false)}
        blocks={BLOCKS}
        onAddBlock={handleAddBlock}
        onRunTests={() => store.getState().setShowRunner(true)}
        onRecord={() => store.getState().setShowRecordBar(true)}
        onNewFile={() => store.getState().newFile()}
      />
    </div>
  );
}
