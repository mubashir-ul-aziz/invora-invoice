import { create } from 'zustand';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { getBusinessRepository } from '@/data/container';
import type { InvoiceSettings, InvoiceSettingsInput } from '@/domain/business/types';

export type InvoiceSettingsStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface InvoiceSettingsState {
  status: InvoiceSettingsStatus;
  settings: InvoiceSettings | null;
  error: string | null;
  load: () => Promise<void>;
  save: (input: InvoiceSettingsInput) => Promise<InvoiceSettings>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createInvoiceSettingsStore` before anything
 * touches the database — same pattern as `businessCardStore`.
 */
export function createInvoiceSettingsStore(
  repository: BusinessRepository = getBusinessRepository(),
) {
  return create<InvoiceSettingsState>((set) => ({
    status: 'idle',
    settings: null,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const settings = await repository.getInvoiceSettings();
        set({ settings, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    save: async (input: InvoiceSettingsInput) => {
      set({ status: 'saving', error: null });
      try {
        const settings = await repository.saveInvoiceSettings(input);
        set({ settings, status: 'ready' });
        return settings;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useInvoiceSettingsStore = createInvoiceSettingsStore();
