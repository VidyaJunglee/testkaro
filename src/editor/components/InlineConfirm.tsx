import React, { useState, useRef, useEffect } from 'react';

interface InlineConfirmProps {
  /** Text shown on the confirm prompt */
  message?: string;
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels (or clicks away) */
  onCancel?: () => void;
  /** The trigger element (rendered always) */
  children: (props: { requestConfirm: () => void }) => React.ReactNode;
}

/**
 * Inline confirmation tooltip — replaces browser confirm() dialogs.
 * Anchors a small "Delete? [Yes] [No]" popover next to the trigger.
 */
export function InlineConfirm({ message = 'Delete?', onConfirm, onCancel, children }: InlineConfirmProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onCancel?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onCancel]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        onCancel?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      {children({ requestConfirm: () => setOpen(true) })}
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-bg-secondary border border-border rounded-md shadow-lg px-3 py-2 flex items-center gap-2 whitespace-nowrap text-xs">
          <span className="text-text-secondary font-medium">{message}</span>
          <button
            onClick={() => { setOpen(false); onConfirm(); }}
            className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
          >
            Yes
          </button>
          <button
            onClick={() => { setOpen(false); onCancel?.(); }}
            className="px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary hover:bg-bg-primary transition-colors font-medium"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
