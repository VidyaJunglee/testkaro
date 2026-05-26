import { StateCreator } from 'zustand';

// ─── Editor Slice ───────────────────────────────────────────────────────────
// Manages visual builder state: selection, breakpoints, drag state

export interface EditorSlice {
  // State
  selectedStepIds: Set<string>;
  lastClickedId: string | null;
  breakpoints: Set<string>;
  highlightedStepId: string | null;
  draggedId: string | null;

  // Actions
  selectStep: (stepId: string, mode: 'single' | 'toggle' | 'range', stepIds?: string[]) => void;
  selectAll: (stepIds: string[]) => void;
  clearSelection: () => void;
  setLastClickedId: (id: string | null) => void;
  toggleBreakpoint: (stepId: string) => void;
  clearBreakpoints: () => void;
  setHighlightedStepId: (id: string | null) => void;
  setDraggedId: (id: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set, get) => ({
  selectedStepIds: new Set(),
  lastClickedId: null,
  breakpoints: new Set(),
  highlightedStepId: null,
  draggedId: null,

  selectStep: (stepId, mode, stepIds) => set(state => {
    if (mode === 'single') {
      const isAlreadySingle = state.selectedStepIds.has(stepId) && state.selectedStepIds.size === 1;
      return {
        selectedStepIds: isAlreadySingle ? new Set() : new Set([stepId]),
        lastClickedId: stepId,
      };
    }
    if (mode === 'toggle') {
      const next = new Set(state.selectedStepIds);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return { selectedStepIds: next, lastClickedId: stepId };
    }
    if (mode === 'range' && stepIds && state.lastClickedId) {
      const startIdx = stepIds.indexOf(state.lastClickedId);
      const endIdx = stepIds.indexOf(stepId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = stepIds.slice(lo, hi + 1);
        return {
          selectedStepIds: new Set([...state.selectedStepIds, ...rangeIds]),
          lastClickedId: stepId,
        };
      }
    }
    return { lastClickedId: stepId };
  }),

  selectAll: (stepIds) => set({ selectedStepIds: new Set(stepIds) }),

  clearSelection: () => set({ selectedStepIds: new Set() }),

  setLastClickedId: (id) => set({ lastClickedId: id }),

  toggleBreakpoint: (stepId) => set(state => {
    const next = new Set(state.breakpoints);
    if (next.has(stepId)) next.delete(stepId);
    else next.add(stepId);
    return { breakpoints: next };
  }),

  clearBreakpoints: () => set({ breakpoints: new Set() }),

  setHighlightedStepId: (id) => set({ highlightedStepId: id }),

  setDraggedId: (id) => set({ draggedId: id }),
});
