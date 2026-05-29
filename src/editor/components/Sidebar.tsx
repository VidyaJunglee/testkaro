import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, DragEndEvent, DragOverEvent, DragStartEvent,
  DragOverlay, PointerSensor, useSensor, useSensors, UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../store';
import { InlineConfirm } from './InlineConfirm';
import { useRoute, navigateToApp } from '../router';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  Package, Edit3, Check, X, FileText, GripVertical,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type DragItemType = 'module' | 'test';
interface DragData { type: DragItemType; moduleIndex: number; testIndex?: number; }

// ─── Sortable Module Row ─────────────────────────────────────────────────────

function SortableModuleRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'module' } as DragData,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.cloneElement(children as React.ReactElement, { dragListeners: listeners })}
    </div>
  );
}

// ─── Sortable Test Row ───────────────────────────────────────────────────────

function SortableTestRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'test' } as DragData,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.cloneElement(children as React.ReactElement, { dragListeners: listeners })}
    </div>
  );
}

// ─── Main Sidebar ────────────────────────────────────────────────────────────

export function Sidebar() {
  const store = useStore;
  const file = useStore(s => s.file);
  const activeTestIndex = useStore(s => s.activeTestIndex);
  const modules = useStore(s => s.modules);
  const activeModuleIndex = useStore(s => s.activeModuleIndex);

  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));
  const [renamingModuleIndex, setRenamingModuleIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingTestIndex, setRenamingTestIndex] = useState<number | null>(null);
  const [testRenameValue, setTestRenameValue] = useState('');
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

  const route = useRoute();
  const currentAppId = route.page === 'app' ? route.appId : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Ctrl/Cmd + T — new test
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        store.getState().addTest();
      }
      // Ctrl/Cmd + M — new module
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        store.getState().addModule(`Module ${modules.length + 1}`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modules.length]);

  // ─── Module Switch ─────────────────────────────────────────────────────────

  const handleSwitchModule = useCallback((index: number) => {
    const mod = modules[index];
    if (!mod) return;
    store.getState().setActiveModuleIndex(index);
    store.getState().setFile({
      version: '1.0',
      name: mod.name,
      description: mod.description,
      baseUrl: mod.baseUrl,
      tests: mod.tests || [{ id: crypto.randomUUID(), name: 'Test 1', steps: [] }],
    });
    store.getState().setActiveTestIndex(0);
    if (currentAppId) navigateToApp(currentAppId, mod.id);
  }, [modules, currentAppId]);

  const handleSelectModule = (index: number) => {
    handleSwitchModule(index);
    store.getState().setViewLevel('module');
  };

  const handleSelectTest = (index: number) => {
    store.getState().setActiveTestIndex(index);
    store.getState().setViewLevel('test');
  };

  // ─── Rename ────────────────────────────────────────────────────────────────

  const handleStartModuleRename = (index: number) => {
    setRenamingModuleIndex(index);
    setRenameValue(modules[index]?.name || '');
  };

  const handleConfirmModuleRename = () => {
    if (renamingModuleIndex !== null && renameValue.trim()) {
      store.getState().renameModule(renamingModuleIndex, renameValue.trim());
    }
    setRenamingModuleIndex(null);
  };

  const handleStartTestRename = (index: number) => {
    setRenamingTestIndex(index);
    setTestRenameValue((file.tests || [])[index]?.name || '');
  };

  const handleConfirmTestRename = () => {
    if (renamingTestIndex !== null && testRenameValue.trim()) {
      store.getState().renameTest(renamingTestIndex, testRenameValue.trim());
    }
    setRenamingTestIndex(null);
  };

  // ─── Expand/Collapse ───────────────────────────────────────────────────────

  const toggleModuleExpand = (index: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Module reorder: ids like "mod-0", "mod-1"
    if (activeId.startsWith('mod-') && overId.startsWith('mod-')) {
      const fromIndex = parseInt(activeId.split('-')[1]);
      const toIndex = parseInt(overId.split('-')[1]);
      store.getState().reorderModules(fromIndex, toIndex);
      return;
    }

    // Test reorder or cross-module move: ids like "test-{moduleIndex}-{testIndex}"
    if (activeId.startsWith('test-') && overId.startsWith('test-')) {
      const [, fromModStr, fromTestStr] = activeId.split('-');
      const [, toModStr, toTestStr] = overId.split('-');
      const fromMod = parseInt(fromModStr);
      const fromTest = parseInt(fromTestStr);
      const toMod = parseInt(toModStr);
      const toTest = parseInt(toTestStr);

      if (fromMod === toMod) {
        // Same module reorder
        store.getState().reorderTests(fromMod, fromTest, toTest);
      } else {
        // Cross-module move
        store.getState().moveTestToModule(fromMod, fromTest, toMod, toTest);
        // Switch to target module
        handleSwitchModule(toMod);
      }
      return;
    }

    // Test dropped on a module row → move to end of that module
    if (activeId.startsWith('test-') && overId.startsWith('mod-')) {
      const [, fromModStr, fromTestStr] = activeId.split('-');
      const fromMod = parseInt(fromModStr);
      const fromTest = parseInt(fromTestStr);
      const toMod = parseInt(overId.split('-')[1]);
      const toTests = modules[toMod]?.tests || [];
      store.getState().moveTestToModule(fromMod, fromTest, toMod, toTests.length);
      handleSwitchModule(toMod);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const moduleIds = modules.map((_, i) => `mod-${i}`);

  return (
    <div className="h-full bg-bg-secondary flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
            onClick={() => store.getState().addTest()}
            title="New Test (Ctrl+T)"
          >
            <FileText size={11} />
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
            onClick={() => store.getState().addModule(`Module ${modules.length + 1}`)}
            title="New Module (Ctrl+M)"
          >
            <Package size={11} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={moduleIds} strategy={verticalListSortingStrategy}>
            {modules.map((mod, mi) => {
              const isActive = mi === activeModuleIndex;
              const isExpanded = expandedModules.has(mi);
              const tests = isActive ? (file.tests || []) : (mod.tests || []);
              const testIds = tests.map((_, ti) => `test-${mi}-${ti}`);

              return (
                <SortableModuleRow key={mod.id} id={`mod-${mi}`}>
                  <ModuleNode
                    mod={mod}
                    index={mi}
                    isActive={isActive}
                    isExpanded={isExpanded}
                    isRenaming={renamingModuleIndex === mi}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onConfirmRename={handleConfirmModuleRename}
                    onCancelRename={() => setRenamingModuleIndex(null)}
                    onStartRename={() => handleStartModuleRename(mi)}
                    onToggleExpand={() => toggleModuleExpand(mi)}
                    onSelect={() => { handleSelectModule(mi); if (!isExpanded) toggleModuleExpand(mi); }}
                    canDelete={modules.length > 1}
                    onDelete={() => store.getState().deleteModule(mi)}
                    testCount={tests.length}
                  >
                    {/* Tests inside expanded active module */}
                    {isExpanded && (
                      <div className="ml-3 border-l border-border/50">
                        <SortableContext items={testIds} strategy={verticalListSortingStrategy}>
                          {tests.map((t, ti) => (
                            <SortableTestRow key={t.id} id={`test-${mi}-${ti}`}>
                              <TestNode
                                test={t}
                                index={ti}
                                isActive={isActive && ti === activeTestIndex}
                                isRenaming={isActive && renamingTestIndex === ti}
                                renameValue={testRenameValue}
                                onRenameChange={setTestRenameValue}
                                onConfirmRename={handleConfirmTestRename}
                                onCancelRename={() => setRenamingTestIndex(null)}
                                onStartRename={() => { if (isActive) handleStartTestRename(ti); }}
                                onSelect={() => { if (!isActive) handleSwitchModule(mi); handleSelectTest(ti); }}
                                canDelete={tests.length > 1}
                                onDelete={() => store.getState().deleteTest(ti)}
                              />
                            </SortableTestRow>
                          ))}
                        </SortableContext>
                        {/* Inline add test */}
                        {isActive && (
                          <button
                            className="flex items-center gap-1.5 w-full px-3 py-1 text-[11px] text-text-tertiary hover:text-accent transition-colors"
                            onClick={() => store.getState().addTest()}
                          >
                            <Plus size={9} />
                            <span>Add test</span>
                          </button>
                        )}
                      </div>
                    )}
                  </ModuleNode>
                </SortableModuleRow>
              );
            })}
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDragId && (
              <div className="px-3 py-1.5 bg-bg-secondary border border-accent/30 rounded shadow-lg text-xs text-text-primary font-medium opacity-90">
                {String(activeDragId).startsWith('mod-')
                  ? modules[parseInt(String(activeDragId).split('-')[1])]?.name || 'Module'
                  : (() => {
                      const [, modStr, testStr] = String(activeDragId).split('-');
                      const mi = parseInt(modStr);
                      const ti = parseInt(testStr);
                      const t = (mi === activeModuleIndex ? (file.tests || []) : (modules[mi]?.tests || []))[ti];
                      return t?.name || 'Test';
                    })()
                }
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border text-[10px] text-text-tertiary shrink-0 flex items-center justify-between">
        <span>
          {modules.length} module{modules.length !== 1 ? 's' : ''} &middot; {(file.tests || []).length} test{(file.tests || []).length !== 1 ? 's' : ''}
        </span>
        <span className="text-[9px] opacity-60">Ctrl+T / Ctrl+M</span>
      </div>
    </div>
  );
}

// ─── Module Node ─────────────────────────────────────────────────────────────

interface ModuleNodeProps {
  mod: { id: string; name: string };
  index: number;
  isActive: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onToggleExpand: () => void;
  onSelect: () => void;
  canDelete: boolean;
  onDelete: () => void;
  testCount: number;
  children?: React.ReactNode;
  dragListeners?: any;
}

function ModuleNode({
  mod, isActive, isExpanded, isRenaming, renameValue,
  onRenameChange, onConfirmRename, onCancelRename, onStartRename,
  onToggleExpand, onSelect, canDelete, onDelete, testCount,
  children, dragListeners,
}: ModuleNodeProps) {
  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-1.5 py-[5px] cursor-pointer text-[11px] transition-all ${
          isActive
            ? 'bg-accent/8 text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover'
        }`}
        onClick={onSelect}
        onDoubleClick={onStartRename}
      >
        {/* Drag handle */}
        <span
          className="w-4 h-4 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
          {...dragListeners}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={9} className="text-text-tertiary" />
        </span>

        {/* Expand chevron */}
        <span
          className="w-4 h-4 flex items-center justify-center shrink-0"
          onClick={e => { e.stopPropagation(); onToggleExpand(); }}
        >
          {isExpanded
            ? <ChevronDown size={10} className="text-text-tertiary" />
            : <ChevronRight size={10} className="text-text-tertiary" />
          }
        </span>

        {/* Icon + name */}
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              className="flex-1 min-w-0 bg-bg-input border border-accent/40 rounded px-1.5 py-0.5 text-[11px] outline-none"
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
              autoFocus
            />
            <button className="text-green-500" onClick={onConfirmRename}><Check size={10} /></button>
            <button className="text-text-tertiary" onClick={onCancelRename}><X size={10} /></button>
          </div>
        ) : (
          <>
            <Package size={11} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text-tertiary'}`} />
            <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>{mod.name}</span>
            <span className="text-[9px] text-text-tertiary tabular-nums">{testCount}</span>
            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              <button
                className="w-4 h-4 flex items-center justify-center rounded text-text-tertiary hover:text-accent"
                onClick={e => { e.stopPropagation(); onStartRename(); }}
              ><Edit3 size={9} /></button>
              {canDelete && (
                <InlineConfirm onConfirm={onDelete} message="Delete?">
                  {({ requestConfirm }) => (
                    <button
                      className="w-4 h-4 flex items-center justify-center rounded text-text-tertiary hover:text-danger"
                      onClick={e => { e.stopPropagation(); requestConfirm(); }}
                    ><Trash2 size={9} /></button>
                  )}
                </InlineConfirm>
              )}
            </div>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Test Node ───────────────────────────────────────────────────────────────

interface TestNodeProps {
  test: { id: string; name: string; steps?: any[] };
  index: number;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onSelect: () => void;
  canDelete: boolean;
  onDelete: () => void;
  dragListeners?: any;
}

function TestNode({
  test, isActive, isRenaming, renameValue,
  onRenameChange, onConfirmRename, onCancelRename, onStartRename,
  onSelect, canDelete, onDelete, dragListeners,
}: TestNodeProps) {
  return (
    <div
      className={`group flex items-center gap-1 px-2 py-[4px] cursor-pointer text-[11px] transition-all ${
        isActive
          ? 'bg-accent/10 text-text-primary font-medium'
          : 'text-text-secondary hover:bg-bg-hover'
      }`}
      onClick={onSelect}
      onDoubleClick={onStartRename}
    >
      {/* Drag handle */}
      <span
        className="w-3.5 h-3.5 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
        {...dragListeners}
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={8} className="text-text-tertiary" />
      </span>

      {isRenaming ? (
        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
          <input
            className="flex-1 min-w-0 bg-bg-input border border-accent/40 rounded px-1.5 py-0.5 text-[11px] outline-none"
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename(); }}
            autoFocus
          />
          <button className="text-green-500" onClick={e => { e.stopPropagation(); onConfirmRename(); }}><Check size={9} /></button>
          <button className="text-text-tertiary" onClick={e => { e.stopPropagation(); onCancelRename(); }}><X size={9} /></button>
        </div>
      ) : (
        <>
          <FileText size={10} className="text-text-tertiary shrink-0" />
          <span className="flex-1 truncate">{test.name}</span>
          <span className="text-[9px] text-text-tertiary tabular-nums">{(test.steps || []).length}s</span>
          {canDelete && (
            <InlineConfirm onConfirm={onDelete} message="Delete?">
              {({ requestConfirm }) => (
                <button
                  className="w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger"
                  onClick={e => { e.stopPropagation(); requestConfirm(); }}
                ><Trash2 size={8} /></button>
              )}
            </InlineConfirm>
          )}
        </>
      )}
    </div>
  );
}
