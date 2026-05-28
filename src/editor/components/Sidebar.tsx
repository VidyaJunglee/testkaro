import React, { useState } from 'react';
import { useStore } from '../store';
import { InlineConfirm } from './InlineConfirm';
import { useRoute, navigateToApp } from '../router';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  Package, Edit3, Check, X, FileText,
} from 'lucide-react';

export function Sidebar() {
  const store = useStore;
  const file = useStore(s => s.file);
  const activeTestIndex = useStore(s => s.activeTestIndex);

  // Module state
  const modules = useStore(s => s.modules);
  const activeModuleIndex = useStore(s => s.activeModuleIndex);

  // Collapse state
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));

  // Rename state
  const [renamingModuleIndex, setRenamingModuleIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingTestIndex, setRenamingTestIndex] = useState<number | null>(null);
  const [testRenameValue, setTestRenameValue] = useState('');

  const route = useRoute();
  const currentAppId = route.page === 'app' ? route.appId : null;

  const handleSwitchModule = (index: number) => {
    const mod = modules[index];
    if (!mod) return;
    store.getState().setActiveModuleIndex(index);
    store.getState().setFile({
      version: '1.0',
      name: mod.name,
      description: mod.description,
      baseUrl: mod.baseUrl,
      tests: mod.tests,
    });
    store.getState().setActiveTestIndex(0);
    if (currentAppId) {
      navigateToApp(currentAppId, mod.id);
    }
  };

  const handleStartRename = (index: number) => {
    setRenamingModuleIndex(index);
    setRenameValue(modules[index].name);
  };

  const handleConfirmRename = () => {
    if (renamingModuleIndex !== null && renameValue.trim()) {
      store.getState().renameModule(renamingModuleIndex, renameValue.trim());
    }
    setRenamingModuleIndex(null);
  };

  const handleStartTestRename = (index: number) => {
    setRenamingTestIndex(index);
    setTestRenameValue(file.tests[index].name);
  };

  const handleConfirmTestRename = () => {
    if (renamingTestIndex !== null && testRenameValue.trim()) {
      store.getState().renameTest(renamingTestIndex, testRenameValue.trim());
    }
    setRenamingTestIndex(null);
  };

  const toggleModuleExpand = (index: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const handleSelectTest = (index: number) => {
    store.getState().setActiveTestIndex(index);
    store.getState().setViewLevel('test');
  };

  const handleSelectModule = (index: number) => {
    handleSwitchModule(index);
    store.getState().setViewLevel('module');
  };

  return (
    <div className="h-full bg-bg-secondary flex flex-col">
      {/* ─── Explorer (Modules + Tests) ──────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <SectionHeader
          label="Explorer"
          expanded={explorerExpanded}
          onToggle={() => setExplorerExpanded(!explorerExpanded)}
          onAdd={() => store.getState().addTest()}
          addTitle="Add test"
        />
        {explorerExpanded && (
          <div className="flex-1 overflow-y-auto pb-1">
              {/* ─── Modular: modules as tree nodes, tests inside ─── */}
              <>
                {modules.map((mod, mi) => {
                  const isActive = mi === activeModuleIndex;
                  const isExpanded = expandedModules.has(mi);

                  return (
                    <div key={mod.id}>
                      {/* Module row */}
                      <div
                        className={`group flex items-center justify-between px-2 py-1 cursor-pointer text-xs transition-all ${
                          isActive ? 'bg-accent/5 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
                        }`}
                        onClick={() => { handleSelectModule(mi); if (!isExpanded) toggleModuleExpand(mi); }}
                        onDoubleClick={() => handleStartRename(mi)}
                      >
                        {renamingModuleIndex === mi ? (
                          <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                            <input
                              className="flex-1 bg-bg-input border border-border-active rounded px-1.5 py-0.5 text-xs outline-none"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingModuleIndex(null); }}
                              autoFocus
                            />
                            <span className="text-green-500 hover:text-green-400 cursor-pointer" onClick={handleConfirmRename} role="button"><Check size={11} /></span>
                            <span className="text-text-tertiary hover:text-text-secondary cursor-pointer" onClick={() => setRenamingModuleIndex(null)} role="button"><X size={11} /></span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 truncate">
                              <span onClick={(e) => { e.stopPropagation(); toggleModuleExpand(mi); }} className="p-0.5">
                                {isExpanded ? <ChevronDown size={10} className="text-text-tertiary" /> : <ChevronRight size={10} className="text-text-tertiary" />}
                              </span>
                              <Package size={11} className={isActive ? 'text-accent shrink-0' : 'text-text-tertiary shrink-0'} />
                              <span className={`truncate ${isActive ? 'font-medium' : ''}`}>{mod.name}</span>
                              <span className="text-[10px] text-text-tertiary">({(mod.tests || []).length})</span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span
                                className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent transition-all cursor-pointer"
                                onClick={e => { e.stopPropagation(); handleStartRename(mi); }}
                                role="button"
                              >
                                <Edit3 size={10} />
                              </span>
                              {modules.length > 1 && (
                                <InlineConfirm onConfirm={() => store.getState().deleteModule(mi)} message="Delete?">
                                  {({ requestConfirm }) => (
                                    <span
                                      className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-danger transition-all cursor-pointer"
                                      onClick={e => { e.stopPropagation(); requestConfirm(); }}
                                      role="button"
                                    >
                                      <Trash2 size={10} />
                                    </span>
                                  )}
                                </InlineConfirm>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Tests inside this module */}
                      {isExpanded && isActive && (
                        <div className="ml-4">
                          {(file.tests || []).map((t, ti) => (
                            <div
                              key={t.id}
                              className={`group flex items-center justify-between px-2 py-1 cursor-pointer text-xs transition-all rounded-sm ${
                                ti === activeTestIndex
                                  ? 'bg-accent/8 text-text-primary font-medium'
                                  : 'text-text-secondary hover:bg-bg-hover'
                              }`}
                              onClick={() => handleSelectTest(ti)}
                              onDoubleClick={() => handleStartTestRename(ti)}
                            >
                              {renamingTestIndex === ti ? (
                                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    className="flex-1 bg-bg-input border border-border-active rounded px-1.5 py-0.5 text-xs outline-none"
                                    value={testRenameValue}
                                    onChange={e => setTestRenameValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmTestRename(); if (e.key === 'Escape') setRenamingTestIndex(null); }}
                                    autoFocus
                                  />
                                  <span className="text-green-500 cursor-pointer" onClick={e => { e.stopPropagation(); handleConfirmTestRename(); }} role="button"><Check size={11} /></span>
                                  <span className="text-text-tertiary cursor-pointer" onClick={e => { e.stopPropagation(); setRenamingTestIndex(null); }} role="button"><X size={11} /></span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 truncate">
                                    <FileText size={10} className="text-text-tertiary shrink-0" />
                                    <span className="truncate">{t.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-text-tertiary">{t.steps.length}</span>
                                    {(file.tests || []).length > 1 && (
                                      <InlineConfirm onConfirm={() => store.getState().deleteTest(ti)} message="Delete?">
                                        {({ requestConfirm }) => (
                                          <span
                                            className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger cursor-pointer"
                                            onClick={e => { e.stopPropagation(); requestConfirm(); }}
                                            role="button"
                                          >
                                            <Trash2 size={9} />
                                          </span>
                                        )}
                                      </InlineConfirm>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          {/* Add test inside module */}
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-tertiary hover:text-accent hover:bg-bg-hover cursor-pointer rounded-sm transition-all"
                            onClick={() => store.getState().addTest()}
                          >
                            <Plus size={10} />
                            <span>Add test</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add module */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-tertiary hover:text-accent hover:bg-bg-hover cursor-pointer transition-all mt-1"
                  onClick={() => store.getState().addModule(`Module ${modules.length + 1}`)}
                >
                  <Plus size={10} />
                  <span>Add module</span>
                </div>
              </>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border text-[11px] text-text-tertiary shrink-0">
        {modules.length > 0 && (
          <span>{modules.length} module{modules.length !== 1 ? 's' : ''} &middot; </span>
        )}
        {(file.tests || []).length} test{(file.tests || []).length !== 1 ? 's' : ''} &middot; auto-saved
      </div>
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ label, expanded, onToggle, onAdd, addTitle, icon }: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between w-full px-3 pt-3 pb-1.5 cursor-pointer select-none shrink-0"
      onClick={onToggle}
    >
      <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold flex items-center gap-1">
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {icon}
        {label}
      </span>
      {onAdd && (
        <span
          className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          title={addTitle}
          role="button"
        >
          <Plus size={12} />
        </span>
      )}
    </div>
  );
}
