import { useStore, useFsLinked, useSessionActions, useEnvironments, useActiveEnvironmentId, useGlobalEnvironments, useActiveGlobalEnvironmentId, useViewLevel } from '../store';
import { navigateToDashboard } from '../router';
import {
  Layers, Undo2, Redo2, Moon, Sun, Code2, Command, Circle,
  PanelRightClose, HardDrive, HardDriveDownload,
  Globe, FolderOpen, ChevronRight, Play,
} from 'lucide-react';

interface Props {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport?: () => void;
  onOpen?: () => void;
  onOpenEnvManager?: () => void;
}

export function TopBar({ onUndo, onRedo, canUndo, canRedo, onOpenEnvManager }: Props) {
  const store = useStore;
  const file = useStore(s => s.file);
  const dirty = useStore(s => s.dirty);
  const tab = useStore(s => s.tab);
  const showRunner = useStore(s => s.showRunner);
  const showRecordBar = useStore(s => s.showRecordBar);
  const recording = useStore(s => s.recording);
  const darkMode = useStore(s => s.darkMode);
  const projectName = useStore(s => s.projectName);
  const viewLevel = useViewLevel();
  const activeTestIndex = useStore(s => s.activeTestIndex);
  const activeModuleIndex = useStore(s => s.activeModuleIndex);
  const modules = useStore(s => s.modules);
  const fsLinked = useFsLinked();
  const { linkFilesystem, unlinkFilesystem } = useSessionActions();

  const activeModuleName = modules[activeModuleIndex]?.name || file.name;
  const activeTestName = file.tests?.[activeTestIndex]?.name || `Test ${activeTestIndex + 1}`;

  const localEnvs = useEnvironments();
  const activeLocalId = useActiveEnvironmentId();
  const globalEnvs = useGlobalEnvironments();
  const activeGlobalId = useActiveGlobalEnvironmentId();

  const activeLocalEnv = localEnvs.find(e => e.id === activeLocalId);
  const activeGlobalEnv = globalEnvs.find(e => e.id === activeGlobalId);
  const activeEnv = activeLocalEnv || activeGlobalEnv;

  return (
    <header className="flex items-center h-14 px-4 bg-bg-secondary border-b border-border shrink-0 glass-panel gap-2">

      {/* ── Left: Identity ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateToDashboard()} title="Back to Dashboard">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center shrink-0">
            <Layers size={14} className="text-on-accent" />
          </div>
          <span className="text-sm font-bold text-text-primary tracking-tight hidden lg:block">TestKaro</span>
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-tertiary shrink-0 hidden md:block">{projectName} /</span>
          <input
            className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-active focus:bg-bg-input text-text-secondary focus:text-text-primary px-2 py-1 rounded-md text-sm w-40 outline-none transition-all"
            value={file.name || ''}
            onChange={e => store.getState().updateFileName(e.target.value)}
          />
          {dirty && <div className="w-1.5 h-1.5 bg-warning rounded-full shrink-0" title="Unsaved changes" />}
        </div>

        <button
          className={`p-1 rounded-lg transition-all ${
            fsLinked
              ? 'text-success/70 hover:text-success'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
          }`}
          onClick={() => fsLinked ? unlinkFilesystem() : linkFilesystem()}
          title={fsLinked ? 'Synced to folder (click to unlink)' : 'Sync to folder'}
        >
          {fsLinked ? <HardDrive size={13} /> : <HardDriveDownload size={13} />}
        </button>
      </div>

      {/* ── Center: Breadcrumb + Tab Switcher ── */}
      <div className="flex-1 flex items-center justify-center min-w-0 gap-3">
        {viewLevel === 'module' ? (
          <span className="text-sm font-semibold text-text-primary truncate">{activeModuleName}</span>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-text-tertiary min-w-0">
              <button
                className="hover:text-text-secondary transition-colors shrink-0 truncate max-w-[100px]"
                onClick={() => store.getState().setViewLevel('module')}
                title={activeModuleName}
              >
                {activeModuleName}
              </button>
              <ChevronRight size={10} className="shrink-0" />
              <span className="text-text-primary font-medium truncate max-w-[140px]">{activeTestName}</span>
            </div>

            <div className="w-px h-4 bg-border shrink-0" />

            <div className="flex items-center bg-bg-primary/50 rounded-lg p-0.5 border border-border-subtle shrink-0">
              <button
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === 'visual'
                    ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
                onClick={() => store.getState().setTab('visual')}
              >
                <Layers size={11} />
                Visual
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  tab === 'json'
                    ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
                onClick={() => store.getState().setTab('json')}
              >
                <Code2 size={11} />
                JSON
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Utilities ── */}
      <div className="flex items-center gap-0.5 shrink-0">

        {/* Environment — single click opens the drawer */}
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border hover:bg-bg-hover transition-all mr-1"
          onClick={() => onOpenEnvManager?.()}
          title="Manage environments"
        >
          {activeLocalEnv ? (
            <FolderOpen size={13} className="text-warning shrink-0" />
          ) : (
            <Globe size={13} className={activeGlobalEnv ? 'text-success' : 'text-text-tertiary'} />
          )}
          <span className="max-w-[90px] truncate">{activeEnv?.name || 'No Env'}</span>
        </button>

        <div className="w-px h-6 bg-border mx-0.5" />

        <button
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-25 disabled:cursor-default"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          <Undo2 size={15} />
        </button>
        <button
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-25 disabled:cursor-default"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={15} />
        </button>

        <div className="w-px h-6 bg-border mx-0.5" />

        <button
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
          onClick={() => store.getState().toggleDarkMode()}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
          onClick={() => store.getState().setCommandPaletteOpen(true)}
          title="Command palette (⌘K)"
        >
          <Command size={14} />
          <kbd className="text-[11px] px-1.5 py-0.5 bg-bg-tertiary rounded border border-border-subtle font-mono">K</kbd>
        </button>

        <div className="w-px h-6 bg-border mx-0.5" />

        <button
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            showRecordBar || recording
              ? 'bg-danger/10 text-danger border border-danger/20'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
          }`}
          onClick={() => store.getState().toggleRecordBar()}
          title="Record (⌘⇧R)"
        >
          <Circle size={11} className={recording ? 'fill-danger text-danger animate-pulse' : ''} />
          Record
        </button>

        <button
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold ml-1 transition-all shadow-sm ${
            showRunner
              ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
              : 'bg-accent text-on-accent hover:bg-accent-hover shadow-md'
          }`}
          onClick={() => store.getState().toggleRunner()}
        >
          {showRunner ? <PanelRightClose size={14} /> : <Play size={14} />}
          {showRunner ? 'Runner' : 'Run'}
        </button>
      </div>
    </header>
  );
}
