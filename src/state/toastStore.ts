import { create } from 'zustand';

/** `error` renders in red; `info` is for outcomes that are neither a success nor a failure (pending, scheduled, nothing to do). */
export type ToastType = 'success' | 'error' | 'info';

export interface ToastContent {
  /** Optional bold first line; most toasts are a single `message` line. */
  title?: string;
  message: string;
}

export interface Toast extends ToastContent {
  id: number;
  type: ToastType;
}

interface ToastState {
  /** The toast on screen (or sliding in/out), or `null` when none is. */
  current: Toast | null;
  show: (type: ToastType, content: string | ToastContent) => void;
  /** Called by `ToastHost` once a toast has slid back out. Ignores a stale id so it never clears a newer toast. */
  dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * The one app-wide action-result toast (see `ToastHost`, mounted once in
 * `App.tsx`). There is only ever one toast: showing the same toast again
 * while it's still on screen is ignored, and a different one replaces it.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: (type, content) => {
    const { title, message } = typeof content === 'string' ? { title: undefined, message: content } : content;
    const current = get().current;
    if (current && current.type === type && current.title === title && current.message === message) {
      return;
    }
    set({ current: { id: nextId++, type, title, message } });
  },
  dismiss: (id) => {
    if (get().current?.id === id) {
      set({ current: null });
    }
  },
}));

/**
 * Show an action-result toast from anywhere — screens, stores, or plain
 * helpers like `lib/linking.ts`. Confirmation prompts (destructive or
 * multi-choice) stay `Alert.alert`; this is only for reporting what happened.
 */
export const toast = {
  show: (type: ToastType, content: string | ToastContent) => useToastStore.getState().show(type, content),
  // Each shorthand goes through `toast.show`, so one `jest.spyOn(toast, 'show')` sees every toast.
  success: (content: string | ToastContent) => toast.show('success', content),
  error: (content: string | ToastContent) => toast.show('error', content),
  info: (content: string | ToastContent) => toast.show('info', content),
};
