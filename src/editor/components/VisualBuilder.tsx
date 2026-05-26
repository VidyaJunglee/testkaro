import React, { useCallback } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BLOCKS } from '../blocks';
import { StepCard } from './StepCard';
import { ActionPalette } from './ActionPalette';
import {
  useStore,
  useSteps, useHighlightedStepId, useBreakpoints, useSelectedStepIds,
} from '../store';

export function VisualBuilder() {
  const steps = useSteps();
  const highlightedStepId = useHighlightedStepId();
  const breakpoints = useBreakpoints();
  const selectedStepIds = useSelectedStepIds();
  const store = useStore;

  const draggedId = useStore(s => s.draggedId);

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
        s.updateSteps(currentSteps.filter(st => !sel.has(st.id)));
        s.clearSelection();
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
      <ActionPalette blocks={BLOCKS} onAdd={addStep} />

      <div
        className="flex-1 overflow-y-auto p-6 bg-bg-primary"
        onClick={(e) => { if (e.target === e.currentTarget) store.getState().clearSelection(); }}
      >
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 text-text-tertiary">
            <div className="w-14 h-14 rounded-xl bg-bg-tertiary border border-dashed border-border flex items-center justify-center text-2xl mb-4">+</div>
            <p className="text-base">No steps yet</p>
            <p className="text-sm text-text-tertiary mt-1">Add actions from the palette on the left</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={e => store.getState().setDraggedId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => store.getState().setDraggedId(null)}
          >
            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5 max-w-2xl">
                {/* Multi-select toolbar */}
                {selectedStepIds.size > 1 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded bg-accent/5 border border-accent/20 text-xs text-accent">
                    <span className="font-medium">{selectedStepIds.size} steps selected</span>
                    <span className="text-text-tertiary">|</span>
                    <button
                      className="hover:underline"
                      onClick={() => {
                        const s = store.getState();
                        const currentSteps = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
                        s.updateSteps(currentSteps.filter(st => !s.selectedStepIds.has(st.id)));
                        s.clearSelection();
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

                {steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    block={BLOCKS.find(b => b.type === step.type)}
                    onUpdate={params => updateStep(step.id, params)}
                    onRemove={() => removeStep(step.id)}
                    onDuplicate={() => duplicateStep(step.id)}
                    highlighted={step.id === highlightedStepId}
                    selected={selectedStepIds.has(step.id)}
                    onSelect={(e) => handleSelect(step.id, e)}
                    hasBreakpoint={breakpoints.has(step.id)}
                    onToggleBreakpoint={() => store.getState().toggleBreakpoint(step.id)}
                    showValidation={true}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {draggedStep ? (
                <div className="bg-bg-card border border-border-active rounded-lg px-3 py-2 shadow-lg text-sm text-text-primary opacity-90">
                  {BLOCKS.find(b => b.type === draggedStep.type)?.label || draggedStep.type}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
