import { create } from 'zustand';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { getBusinessRepository } from '@/data/container';
import type { InvoiceTypeSelection, InvoiceTypeSelectionInput } from '@/domain/invoiceType/types';

export type InvoiceTypeStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface InvoiceTypeState {
  status: InvoiceTypeStatus;
  selection: InvoiceTypeSelection | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: InvoiceTypeSelectionInput) => Promise<InvoiceTypeSelection>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createInvoiceTypeStore` before anything touches
 * the database — same pattern as `invoiceSettingsStore`.
 */
export function createInvoiceTypeStore(repository: BusinessRepository = getBusinessRepository()) {
  return create<InvoiceTypeState>((set) => ({
    status: 'idle',
    selection: null,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const selection = await repository.getInvoiceTypeSelection();
        set({ selection, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async (input: InvoiceTypeSelectionInput) => {
      set({ status: 'saving', error: null });
      try {
        const selection = await repository.saveInvoiceTypeSelection(input);
        set({ selection, status: 'ready' });
        return selection;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useInvoiceTypeStore = createInvoiceTypeStore();
