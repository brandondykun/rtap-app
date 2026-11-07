import { create } from 'zustand';

/** `average`: Average mode's own notice (hold still), in its orange, with a `title`. */
export type ToastKind = 'error' | 'info' | 'average';
/**
 * `detail`: a quieter second line (what to do about it). `title`: a short heading before the message (Average mode's
 * notice). `sticky`: stays until its close button is pressed (no timeout, no tap-to-dismiss).
 */
type ToastValue = { id: number; message: string; title?: string; detail?: string; kind: ToastKind; sticky: boolean };

type ToastState = {
  toast: ToastValue | null;
  show: (message: string, kind?: ToastKind, opts?: { sticky?: boolean; detail?: string; title?: string }) => void;
  /** Hides the current toast; with an id, only if it is still that toast. */
  hide: (id?: number) => void;
};

let nextId = 1;

export const useToast = create<ToastState>()((set, get) => ({
  toast: null,
  show: (message, kind = 'error', opts) => set({ toast: { id: nextId++, message, title: opts?.title, detail: opts?.detail, kind, sticky: opts?.sticky ?? false } }),
  hide: (id) => {
    const current = get().toast;
    if (current && (id === undefined || current.id === id)) set({ toast: null });
  },
}));
