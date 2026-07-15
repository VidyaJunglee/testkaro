import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Info, HelpCircle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when modal should close (cancel/escape/backdrop click) */
  onClose: () => void;
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Description/body text */
  description?: string | React.ReactNode;
  /** Text for the confirm button */
  confirmLabel?: string;
  /** Text for the cancel button */
  cancelLabel?: string;
  /** Visual variant controls colors and icon */
  variant?: ConfirmVariant;
  /** Whether confirm action is in progress (shows spinner, disables buttons) */
  loading?: boolean;
}

// ─── Variant Styles ──────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ConfirmVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmBtn: string;
}> = {
  danger: {
    icon: <Trash2 size={20} />,
    iconBg: 'bg-danger/10 text-danger',
    confirmBtn: 'bg-danger text-white hover:bg-danger/90',
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    iconBg: 'bg-amber-500/10 text-amber-500',
    confirmBtn: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  info: {
    icon: <HelpCircle size={20} />,
    iconBg: 'bg-accent/10 text-accent',
    confirmBtn: 'bg-accent text-on-accent hover:bg-accent/90',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // Focus confirm button on open
  useEffect(() => {
    if (open) {
      // Small delay to allow animation
      const t = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const config = VARIANT_CONFIG[variant];

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-elevated border border-border rounded-xl w-full max-w-sm mx-4 shadow-2xl animate-glass-reveal">
        {/* Close button */}
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          onClick={onClose}
        >
          <X size={14} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${config.iconBg}`}>
            {config.icon}
          </div>

          {/* Title */}
          <h3 id="confirm-modal-title" className="text-base font-semibold text-text-primary">
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-bg-secondary/50 rounded-b-xl">
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-tertiary text-text-primary hover:bg-border transition-all disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 ${config.confirmBtn}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
