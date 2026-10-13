import { create } from 'zustand';

export type ToastKind = 'error' | 'info';
type ToastValue = { id: number; message: string; kind: ToastKind };

type ToastState = {
  toast: ToastValue | null;
  show: (message: string, kind?: ToastKind) => void;
  /** Hides the current toast; with an id, only if it is still that toast. */
  hide: (id?: number) => void;
};

let nextId = 1;

export const useToast = create<ToastState>()((set, get) => ({
  toast: null,
  show: (message, kind = 'error') => set({ toast: { id: nextId++, message, kind } }),
  hide: (id) => {
    const current = get().toast;
    if (current && (id === undefined || current.id === id)) set({ toast: null });
  },
}));
