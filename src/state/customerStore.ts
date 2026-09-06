import { create } from 'zustand';

import type { CustomerRepository } from '@/data/customer/CustomerRepository';
import { getCustomerRepository } from '@/data/container';
import {
  EMPTY_CUSTOMER_FILTER,
  type Customer,
  type CustomerFilter,
  type CustomerInput,
} from '@/domain/customer/types';

export type CustomerListStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CustomerState {
  status: CustomerListStatus;
  customers: Customer[];
  filter: CustomerFilter;
  error: string | null;
  /** Merges a partial filter change (search text) and reloads. */
  setFilter: (patch: Partial<CustomerFilter>) => Promise<void>;
  load: () => Promise<void>;
  getById: (id: string) => Promise<Customer | null>;
  create: (input: CustomerInput) => Promise<Customer>;
  update: (id: string, input: CustomerInput) => Promise<Customer>;
  remove: (id: string) => Promise<void>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createCustomerStore` before anything touches the
 * database — same pattern as `itemStore`.
 */
export function createCustomerStore(repository: CustomerRepository = getCustomerRepository()) {
  return create<CustomerState>((set, get) => ({
    status: 'idle',
    customers: [],
    filter: EMPTY_CUSTOMER_FILTER,
    error: null,

    setFilter: async (patch) => {
      set((state) => ({ filter: { ...state.filter, ...patch } }));
      await get().load();
    },

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const customers = await repository.list(get().filter);
        set({ customers, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    getById: async (id) => repository.getById(id),

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
export const useCustomerStore = createCustomerStore();
