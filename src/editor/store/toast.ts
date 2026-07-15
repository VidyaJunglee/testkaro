import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

const DURATION_MS = 5000;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  dismiss: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

function push(message: string, variant: ToastVariant) {
  const id = crypto.randomUUID();
  useToastStore.setState(state => ({ toasts: [...state.toasts, { id, message, variant }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), DURATION_MS);
}

// Small pub-sub for surfacing failures that previously failed silently
// (IndexedDB writes, filesystem sync, etc.) — call from a .catch() handler.
export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
  info: (message: string) => push(message, 'info'),
};
