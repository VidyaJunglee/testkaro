import { TestStep } from '../../schema';

// Container steps (if/repeat/try_catch/for_each) nest their body under
// `children`. The visual builder used to only look at the top-level steps
// array when updating/removing/reordering, so any edit made to a step nested
// inside a container silently no-op'd — these helpers walk the whole tree.

export function findStepById(steps: TestStep[], id: string): TestStep | null {
  for (const st of steps) {
    if (st.id === id) return st;
    if (st.children?.length) {
      const found = findStepById(st.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function mapStepTree(steps: TestStep[], id: string, fn: (step: TestStep) => TestStep): TestStep[] {
  return steps.map(st => {
    if (st.id === id) return fn(st);
    if (st.children?.length) return { ...st, children: mapStepTree(st.children, id, fn) };
    return st;
  });
}

export function removeStepFromTree(steps: TestStep[], id: string): TestStep[] {
  return steps
    .filter(st => st.id !== id)
    .map(st => (st.children?.length ? { ...st, children: removeStepFromTree(st.children, id) } : st));
}

export function insertAfterInTree(steps: TestStep[], afterId: string, newStep: TestStep): TestStep[] {
  const idx = steps.findIndex(st => st.id === afterId);
  if (idx !== -1) {
    const copy = [...steps];
    copy.splice(idx + 1, 0, newStep);
    return copy;
  }
  return steps.map(st =>
    st.children?.length ? { ...st, children: insertAfterInTree(st.children, afterId, newStep) } : st
  );
}

export function appendChildInTree(steps: TestStep[], parentId: string, newStep: TestStep): TestStep[] {
  return steps.map(st => {
    if (st.id === parentId) return { ...st, children: [...(st.children || []), newStep] };
    if (st.children?.length) return { ...st, children: appendChildInTree(st.children, parentId, newStep) };
    return st;
  });
}

// Deep-clones a step with fresh ids all the way down — duplicating a
// container without this would leave the copy's nested children sharing ids
// with the original, breaking id-based lookups for both.
export function cloneStepWithNewIds(step: TestStep): TestStep {
  return {
    ...step,
    id: crypto.randomUUID(),
    params: { ...step.params },
    children: step.children?.map(cloneStepWithNewIds),
  };
}

// Reorders active/over within whichever array (top-level or a single
// container's children) actually contains both ids. If they belong to
// different arrays the tree is returned unchanged rather than corrupted.
export function reorderInTree(steps: TestStep[], activeId: string, overId: string): TestStep[] {
  const oldIndex = steps.findIndex(st => st.id === activeId);
  const overIndex = steps.findIndex(st => st.id === overId);
  if (oldIndex !== -1 && overIndex !== -1) {
    const copy = [...steps];
    const [moved] = copy.splice(oldIndex, 1);
    copy.splice(overIndex, 0, moved);
    return copy;
  }
  return steps.map(st => {
    if (!st.children?.length) return st;
    const activeIsChild = st.children.some(c => c.id === activeId);
    return activeIsChild ? { ...st, children: reorderInTree(st.children, activeId, overId) } : st;
  });
}
