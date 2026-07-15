import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Circle, Search, X } from 'lucide-react';
import { BLOCKS } from '../blocks';
import { StepCard } from './StepCard';
import { TestStep } from '../../schema';
import {
  useStore,
  useHighlightedStepId, useBreakpoints, useSelectedStepIds,
} from '../store';

export function VisualBuilder() {
  const file = useStore(s => s.file);
  const activeTestIndex = useStore(s => s.activeTestIndex);
  const recording = useStore(s => s.recording);
  const steps = (file.tests?.[activeTestIndex] || file.tests?.[0])?.steps || [];
  const highlightedStepId = useHighlightedStepId();
  const breakpoints = useBreakpoints();
  const selectedStepIds = useSelectedStepIds();
  const store = useStore;
  const [filterQuery, setFilterQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const draggedId = useStore(s => s.draggedId);
  const results = useStore(s => s.results);
  const lastResultByStep = useMemo(() => {
    const map: Record<string, { status: string; error?: string }> = {};
    for (const r of results) map[r.stepId] = { status: r.status, error: r.error };
    return map;
  }, [results]);

  // Multi-select handler
  const handleSelect = useCallback((stepId: string, e: React.MouseEvent) => {
    const s = store.getState();
    if (e.shiftKey) {
      s.selectStep(stepId, 'range', steps.map(st => st.id));
    } else if (e.metaKey || e.ctrlKey) {
      s.selectStep(stepId, 'toggle');
    } else {
      s.selectStep(stepId, 'single');
    }
  }, [steps]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const s = store.getState();
      const sel = s.selectedStepIds;
      const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;

      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size > 0) {
        e.preventDefault();
        if (sel.size > 1) {
          s.showConfirm({
            title: `Delete ${sel.size} steps?`,
            description: 'This cannot be undone from here (use Undo to recover).',
            confirmLabel: 'Delete Steps',
            variant: 'danger',
            onConfirm: () => {
              const st = store.getState();
              const steps2 = (st.file.tests[st.activeTestIndex] || st.file.tests[0]).steps;
              st.updateSteps(steps2.filter(step => !sel.has(step.id)));
              st.clearSelection();
            },
          });
        } else {
          s.updateSteps(currentSteps.filter(st2 => !sel.has(st2.id)));
          s.clearSelection();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        s.selectAll(currentSteps.map(st => st.id));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && sel.size > 0) {
        e.preventDefault();
        const copies = currentSteps
          .filter(st => sel.has(st.id))
          .map(st => ({ ...st, id: crypto.randomUUID(), params: { ...st.params } }));
        s.updateSteps([...currentSteps, ...copies]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ⌘F search shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setFilterQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  const invalidStepCount = useMemo(() => {
    let count = 0;
    const walk = (list: TestStep[]) => {
      for (const st of list) {
        const block = BLOCKS.find(b => b.type === st.type);
        if (block?.inputs.some(i => i.required && !st.params[i.name])) count++;
        if (st.children?.length) walk(st.children);
      }
    };
    walk(steps);
    return count;
  }, [steps]);

  const filteredSteps = filterQuery
    ? steps.filter(st =>
        st.type.toLowerCase().includes(filterQuery.toLowerCase()) ||
        Object.values(st.params).some(v => String(v).toLowerCase().includes(filterQuery.toLowerCase())) ||
        (st.description?.toLowerCase().includes(filterQuery.toLowerCase()) ?? false)
      )
    : steps;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    store.getState().setDraggedId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    const oldIndex = currentSteps.findIndex(st => st.id === active.id);
    const newIndex = currentSteps.findIndex(st => st.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      s.updateSteps(arrayMove(currentSteps, oldIndex, newIndex));
    }
  };

  const addStep = (blockType: string) => {
    const block = BLOCKS.find(b => b.type === blockType);
    if (!block) return;
    const params: Record<string, unknown> = {};
    block.inputs.forEach(input => {
      params[input.name] = input.default !== undefined ? input.default : '';
    });
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    s.updateSteps([...currentSteps, { id: crypto.randomUUID(), type: blockType, params }]);
  };

  const updateStep = (id: string, params: Record<string, unknown>) => {
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    s.updateSteps(currentSteps.map(st => st.id === id ? { ...st, params } : st));
  };

  const updateStepMeta = (id: string, updates: Partial<TestStep>) => {
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    s.updateSteps(currentSteps.map(st => st.id === id ? { ...st, ...updates } : st));
  };

  const removeStep = (id: string) => {
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    s.updateSteps(currentSteps.filter(st => st.id !== id));
  };

  const duplicateStep = (id: string) => {
    const s = store.getState();
    const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
    const step = currentSteps.find(st => st.id === id);
    if (!step) return;
    const idx = currentSteps.indexOf(step);
    const copy = { ...step, id: crypto.randomUUID(), params: { ...step.params } };
    const newSteps = [...currentSteps];
    newSteps.splice(idx + 1, 0, copy);
    s.updateSteps(newSteps);
  };

  const draggedStep = draggedId ? steps.find(s => s.id === draggedId) : null;

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div
        className="flex-1 overflow-y-auto bg-bg-primary canvas-bg"
        onClick={(e) => { if (e.target === e.currentTarget) store.getState().clearSelection(); }}
      >
        {steps.length === 0 ? (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-text-tertiary px-6">
            <div className="w-16 h-16 rounded-xl bg-bg-tertiary border border-dashed border-border flex items-center justify-center text-2xl mb-4">+</div>
            <p className="text-base font-medium">No steps yet</p>
            <p className="text-sm text-text-tertiary mt-2">Record your interactions or add steps manually</p>
            <div className="flex items-center gap-3 mt-5">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/80 transition-colors"
                onClick={() => store.getState().setShowRecordBar(true)}
              >
                <Circle size={12} className="fill-current" />
                Start Recording
              </button>
              <span className="text-xs text-text-tertiary">or</span>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors"
                onClick={() => store.getState().setActionPickerOpen(true)}
              >
                <Plus size={15} />
                Add Step
              </button>
            </div>
            <p className="text-xs text-text-tertiary mt-4">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border text-[11px]">Ctrl+Shift+R</kbd> to record &middot; <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border text-[11px]">Cmd+P</kbd> to add blocks
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 pt-5 pb-10">
            {/* Validation summary */}
            {invalidStepCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-lg bg-danger/5 border border-danger/20 text-sm">
                <span className="w-2 h-2 bg-danger rounded-full shrink-0" />
                <span className="text-danger font-medium">
                  {invalidStepCount} step{invalidStepCount === 1 ? '' : 's'} missing required field{invalidStepCount === 1 ? '' : 's'}
                </span>
                <span className="text-text-tertiary text-xs">— fix before running</span>
              </div>
            )}

            {/* Recording indicator */}
            {recording && (
              <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-lg bg-danger/5 border border-danger/20 text-sm animate-pulse">
                <span className="w-2 h-2 bg-danger rounded-full" />
                <span className="text-danger font-medium">Recording</span>
                <span className="text-text-tertiary text-xs">— interact with the browser to capture steps</span>
              </div>
            )}

            {/* Step search bar */}
            {searchOpen && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-bg-card border border-border animate-slide-up">
                <Search size={13} className="text-text-tertiary shrink-0" />
                <input
                  ref={searchRef}
                  className="flex-1 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-tertiary"
                  placeholder="Filter steps by type or value…"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                />
                {filterQuery && (
                  <span className="text-[11px] text-text-tertiary">{filteredSteps.length}/{steps.length}</span>
                )}
                <button
                  className="p-0.5 rounded text-text-tertiary hover:text-text-secondary"
                  onClick={() => { setSearchOpen(false); setFilterQuery(''); }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={e => store.getState().setDraggedId(String(e.active.id))}
              onDragEnd={handleDragEnd}
              onDragCancel={() => store.getState().setDraggedId(null)}
            >
              <SortableContext items={filteredSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {/* Multi-select toolbar */}
                  {selectedStepIds.size > 1 && (
                    <div className="flex items-center gap-3 px-4 py-2 mb-1 rounded-lg bg-accent/5 border border-accent/20 text-sm text-accent">
                      <span className="font-medium">{selectedStepIds.size} steps selected</span>
                      <span className="text-text-tertiary">|</span>
                      <button
                        className="hover:underline"
                        onClick={() => {
                          const s = store.getState();
                          const count = s.selectedStepIds.size;
                          s.showConfirm({
                            title: `Delete ${count} steps?`,
                            description: 'This cannot be undone from here (use Undo to recover).',
                            confirmLabel: 'Delete Steps',
                            variant: 'danger',
                            onConfirm: () => {
                              const st = store.getState();
                              const currentSteps = (st.file.tests?.[st.activeTestIndex] || st.file.tests?.[0])?.steps || [];
                              st.updateSteps(currentSteps.filter(step => !st.selectedStepIds.has(step.id)));
                              st.clearSelection();
                            },
                          });
                        }}
                      >
                        Delete
                      </button>
                      <button
                        className="hover:underline"
                        onClick={() => store.getState().clearSelection()}
                      >
                        Deselect
                      </button>
                    </div>
                  )}

                  {filteredSteps.map((step, index) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      index={index}
                      block={BLOCKS.find(b => b.type === step.type)}
                      onUpdate={params => updateStep(step.id, params)}
                      onUpdateStep={updates => updateStepMeta(step.id, updates)}
                      onRemove={() => removeStep(step.id)}
                      onDuplicate={() => duplicateStep(step.id)}
                      highlighted={step.id === highlightedStepId}
                      selected={selectedStepIds.has(step.id)}
                      onSelect={(e) => handleSelect(step.id, e)}
                      hasBreakpoint={breakpoints.has(step.id)}
                      onToggleBreakpoint={() => store.getState().toggleBreakpoint(step.id)}
                      showValidation={true}
                      lastStatus={lastResultByStep[step.id]?.status as 'passed' | 'failed' | 'skipped' | undefined}
                      lastError={lastResultByStep[step.id]?.error}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {draggedStep ? (
                  <div className="bg-bg-card border border-border-active rounded-lg px-4 py-2.5 shadow-lg text-sm text-text-primary opacity-90">
                    {BLOCKS.find(b => b.type === draggedStep.type)?.label || draggedStep.type}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Add Step button - anchored below steps */}
            <button
              className="w-full flex items-center justify-center gap-2 mt-5 py-3.5 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 text-text-tertiary hover:text-accent transition-all text-sm font-medium"
              onClick={() => store.getState().setActionPickerOpen(true)}
            >
              <Plus size={16} />
              Add Step
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
