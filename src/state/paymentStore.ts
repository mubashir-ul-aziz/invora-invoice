import { create } from 'zustand';

import { getPaymentRepository } from '@/data/container';
import type { PaymentRepository } from '@/data/payment/PaymentRepository';
import {
  EMPTY_PAYMENT_FILTER,
  type Payment,
  type PaymentFilter,
  type PaymentInput,
  type PaymentUpdateInput,
} from '@/domain/payment/types';

export type PaymentListStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PaymentState {
  status: PaymentListStatus;
  entries: Payment[];
  filter: PaymentFilter;
  error: string | null;
  /** Merges a partial filter change (search text and/or method) and reloads. */
  setFilter: (patch: Partial<PaymentFilter>) => Promise<void>;
  load: () => Promise<void>;
  getById: (id: string) => Promise<Payment | null>;
  listByInvoice: (invoiceId: string) => Promise<Payment[]>;
  create: (input: PaymentInput) => Promise<Payment>;
  update: (id: string, input: PaymentUpdateInput) => Promise<Payment>;
  remove: (id: string) => Promise<void>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createPaymentStore` before anything touches the
 * database — same pattern as `itemStore`/`invoiceStore`.
 */
export function createPaymentStore(repository: PaymentRepository = getPaymentRepository()) {
  return create<PaymentState>((set, get) => ({
    status: 'idle',
    entries: [],
    filter: EMPTY_PAYMENT_FILTER,
    error: null,

    setFilter: async (patch) => {
      set((state) => ({ filter: { ...state.filter, ...patch } }));
      await get().load();
    },

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const entries = await repository.list(get().filter);
        set({ entries, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    getById: async (id) => repository.getById(id),

    listByInvoice: async (invoiceId) => repository.listByInvoice(invoiceId),

    create: async (input) => {
      const created = await repository.create(input);
      await get().load();
      return created;
    },

    update: async (id, input) => {
      const updated = await repository.update(id, input);
      await get().load();
      return updated;
    },

    remove: async (id) => {
      await repository.delete(id);
      await get().load();
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const usePaymentStore = createPaymentStore();
