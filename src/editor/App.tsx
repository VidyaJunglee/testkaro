import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useStore as useZustandStore } from 'zustand';
import { TestStep } from '../schema';
import { VisualBuilder } from './components/VisualBuilder';
import { JsonEditor } from './components/JsonEditor';
import { ExecutionPanel } from './components/ExecutionPanel';
import { RecordBar } from './components/RecordBar';
import { CommandPalette } from './components/CommandPalette';
import { ActionPicker } from './components/ActionPicker';
import { EnvDrawer } from './components/EnvDrawer';
import { TopBar } from './components/TopBar';
import { ModuleOverview } from './components/ModuleOverview';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AppLoader } from './components/AppLoader';
import { BLOCKS } from './blocks';
import { useRoute, AppRoute } from './router';
import {
  useStore,
  useFile, useFileId,
  useTab, useShowRunner, useShowRecordBar, useCommandPaletteOpen, useActionPickerOpen, useViewLevel,
} from './store';

// ─── Editor View ─────────────────────────────────────────────────────────────

function EditorView({ route }: { route: AppRoute }) {
  const file = useFile();
  const fileId = useFileId();
  const tab = useTab();
  const viewLevel = useViewLevel();
  const showRunner = useShowRunner();
  const showRecordBar = useShowRecordBar();
  const commandPaletteOpen = useCommandPaletteOpen();
  const actionPickerOpen = useActionPickerOpen();

  const store = useStore;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Panel widths (persisted to localStorage)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('testkaro-sidebar-width');
    return saved ? Number(saved) : 220;
  });
  const [runnerWidth, setRunnerWidth] = useState(() => {
    const saved = localStorage.getItem('testkaro-runner-width');
    return saved ? Number(saved) : 440;
  });

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
      localStorage.setItem('testkaro-sidebar-width', String(sidebarWidth));
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
      setRunnerWidth(Math.max(320, Math.min(700, startWidth + delta)));
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('testkaro-runner-width', String(runnerWidth));
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

  // Auto-save: debounced persist to app registry
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      store.getState().persistApp();
    }, 800);
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = store.getState();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); s.setCommandPaletteOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); if (s.viewLevel === 'test') s.setActionPickerOpen(true); }
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
      <TopBar
        onUndo={() => undo()}
        onRedo={() => redo()}
        canUndo={canUndo}
        canRedo={canRedo}
        onOpenEnvManager={() => store.getState().setEnvDrawerOpen(true)}
      />

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
        <aside style={{ width: sidebarWidth }} className="h-full border-r border-border shrink-0">
          <Sidebar />
        </aside>

        {/* Sidebar resize handle */}
        <div
          className="w-1.5 cursor-col-resize bg-transparent hover:bg-accent/50 active:bg-accent transition-colors shrink-0 relative z-10"
          onPointerDown={handleSidebarResize}
        />

        {/* Editor */}
        <div className="flex-1 min-w-[300px] h-full relative">
          {viewLevel === 'module' ? (
            <ModuleOverview />
          ) : (
            <>
              <div className={`absolute inset-0 ${tab === 'visual' ? '' : 'invisible'}`}>
                <VisualBuilder />
              </div>
              <div className={`absolute inset-0 ${tab === 'json' ? '' : 'invisible'}`}>
                <JsonEditor file={file} onChange={(f) => store.getState().setFile(f)} />
              </div>
            </>
          )}
        </div>

        {/* Runner */}
        {showRunner && (
          <>
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

      <ActionPicker onAddBlock={handleAddBlock} />

      <EnvDrawer />
    </div>
  );
}

// ─── Root App (Router) ───────────────────────────────────────────────────────

export function App() {
  const route = useRoute();

  // Apply dark class on mount
  useEffect(() => {
    if (useStore.getState().darkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  switch (route.page) {
    case 'dashboard':
      return <Dashboard />;

    case 'app':
      return (
        <AppLoader route={route}>
          <EditorView route={route} />
        </AppLoader>
      );

    case 'not-found':
      return <Dashboard />;
  }
}
