import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, ToastVariant } from '../store/toast';

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-success shrink-0" />,
  error: <AlertCircle size={16} className="text-danger shrink-0" />,
  info: <Info size={16} className="text-accent shrink-0" />,
};

const BORDER: Record<ToastVariant, string> = {
  success: 'border-success/30',
  error: 'border-danger/30',
  info: 'border-accent/30',
};

export function Toaster() {
  const toasts = useToastStore(s => s.toasts);
  const dismiss = useToastStore(s => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-lg bg-bg-elevated border ${BORDER[t.variant]} shadow-lg text-sm text-text-primary animate-glass-reveal`}
        >
          {ICONS[t.variant]}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            className="text-text-tertiary hover:text-text-primary shrink-0"
            onClick={() => dismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
