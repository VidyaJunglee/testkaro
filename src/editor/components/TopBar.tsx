import React, { useState, useRef, useEffect } from 'react';
import { useStore, useFsLinked, useSessionActions, useEnvironments, useActiveEnvironmentId, useEnvActions, useViewLevel } from '../store';
import { navigateToDashboard } from '../router';
import {
  FolderOpen, Save, Download, Plus, Layers, Undo2, Redo2,
  Moon, Sun, Code2, Command, Circle, PanelRightOpen, PanelRightClose,
  LayoutDashboard, HardDrive, HardDriveDownload, Globe, ChevronDown, Settings2,
  ChevronRight,
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

export function TopBar({ onUndo, onRedo, canUndo, canRedo, onExport, onOpen, onOpenEnvManager }: Props) {
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

  // Environment selector
  const environments = useEnvironments();
  const activeEnvId = useActiveEnvironmentId();
  const { setActiveEnvironment } = useEnvActions();
  const activeEnv = environments.find(e => e.id === activeEnvId);
  const [envDropdownOpen, setEnvDropdownOpen] = useState(false);
  const envDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
        setEnvDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-bg-secondary border-b border-border shrink-0">
      {/* Left: Back + Logo + File name */}
      <div className="flex items-center gap-3">
        <button
          className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
          onClick={() => navigateToDashboard()}
          title="Back to Dashboard"
        >
          <LayoutDashboard size={14} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-accent to-blue-700 rounded flex items-center justify-center">
            <Layers size={11} className="text-white" />
          </div>
          <span className="text-sm font-bold text-text-primary tracking-tight">TestKaro</span>
        </div>

        {/* File/Project name */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs text-text-tertiary mr-1">{projectName} /</span>
          <input
            className="bg-transparent border border-transparent hover:border-border-subtle focus:border-border-active focus:bg-bg-input text-text-secondary focus:text-text-primary px-2 py-1 rounded text-sm w-44 outline-none transition-all"
            value={file.name || ''}
            onChange={e => store.getState().updateFileName(e.target.value)}
          />
          {dirty && <div className="w-1.5 h-1.5 bg-warning rounded-full" title="Unsaved" />}
        </div>

        {/* Open / Export */}
        {onOpen && (
          <button
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
            onClick={onOpen}
            title="Open project folder"
          >
            <FolderOpen size={14} />
          </button>
        )}
        {onExport && (
          <button
            className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
            onClick={onExport}
            title="Export project"
          >
            <Download size={14} />
          </button>
        )}

        {/* Filesystem link */}
        <button
          className={`p-1.5 rounded transition-all ${
            fsLinked
              ? 'text-success hover:text-text-secondary hover:bg-bg-hover'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
          }`}
          onClick={() => fsLinked ? unlinkFilesystem() : linkFilesystem()}
          title={fsLinked ? 'Linked to folder (click to unlink)' : 'Save to folder'}
        >
          {fsLinked ? <HardDrive size={14} /> : <HardDriveDownload size={14} />}
        </button>

        {/* Environment Selector */}
        <div className="relative ml-1" ref={envDropdownRef}>
          <button
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle transition-all"
            onClick={() => setEnvDropdownOpen(!envDropdownOpen)}
            title="Switch environment"
          >
            <Globe size={11} className={activeEnv ? 'text-success' : 'text-text-tertiary'} />
            <span className="max-w-20 truncate">{activeEnv?.name || 'No Env'}</span>
            <ChevronDown size={10} className="text-text-tertiary" />
          </button>

          {envDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50">
              {environments.length > 0 ? (
                <div className="py-1">
                  {environments.map(env => (
                    <button
                      key={env.id}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-all ${
                        env.id === activeEnvId
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                      onClick={() => { setActiveEnvironment(env.id); setEnvDropdownOpen(false); }}
                    >
                      <Globe size={10} className={env.id === activeEnvId ? 'text-accent' : 'text-text-tertiary'} />
                      {env.name}
                      <span className="ml-auto text-[10px] text-text-tertiary">
                        {Object.keys(env.variables).length} vars
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-[10px] text-text-tertiary">No environments</div>
              )}
              {onOpenEnvManager && (
                <div className="border-t border-border-subtle">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
                    onClick={() => { onOpenEnvManager(); setEnvDropdownOpen(false); }}
                  >
                    <Settings2 size={10} />
                    Manage Environments
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Breadcrumb or Tabs */}
      {viewLevel === 'module' ? (
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">{activeModuleName}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary mr-3">
            <button
              className="hover:text-text-secondary transition-colors"
              onClick={() => store.getState().setViewLevel('module')}
            >
              {activeModuleName}
            </button>
            <ChevronRight size={10} />
            <span className="text-text-primary font-medium">{activeTestName}</span>
          </div>

          {/* Tabs */}
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
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        <button
          className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-default"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-30 disabled:cursor-default"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

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
  );
}
