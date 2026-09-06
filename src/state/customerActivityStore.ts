import { create } from 'zustand';

import type { CustomerActivityRepository } from '@/data/customerActivity/CustomerActivityRepository';
import { getCustomerActivityRepository } from '@/data/container';
import {
  EMPTY_CUSTOMER_ACTIVITY_FILTER,
  EMPTY_CUSTOMER_BALANCE_SUMMARY,
  type CustomerActivityEntry,
  type CustomerActivityFilter,
  type CustomerBalanceSummary,
} from '@/domain/customer/types';

export type CustomerActivityStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CustomerActivityState {
  status: CustomerActivityStatus;
  /** The customer this loaded data belongs to; null before the first `load()`. */
  customerId: string | null;
  summary: CustomerBalanceSummary;
  history: CustomerActivityEntry[];
  filter: CustomerActivityFilter;
  error: string | null;
  /** Loads both the summary and the (filtered) history for a customer. */
  load: (customerId: string) => Promise<void>;
  /** Merges a partial filter change and re-fetches history for the current customer. */
  setFilter: (patch: Partial<CustomerActivityFilter>) => Promise<void>;
}

/**
 * Backs both Customer Detail (the summary numbers) and Customer History (the
 * filtered chronological list) — one load per customer visit, same
 * "dependencies resolved lazily" pattern as every other store in this
 * codebase so tests can inject an in-memory repository.
 */
export function createCustomerActivityStore(
  repository: CustomerActivityRepository = getCustomerActivityRepository(),
) {
  return create<CustomerActivityState>((set, get) => ({
    status: 'idle',
    customerId: null,
    summary: EMPTY_CUSTOMER_BALANCE_SUMMARY,
    history: [],
    filter: EMPTY_CUSTOMER_ACTIVITY_FILTER,
    error: null,

    load: async (customerId) => {
      set({ status: 'loading', error: null, customerId, filter: EMPTY_CUSTOMER_ACTIVITY_FILTER });
      try {
        const [summary, history] = await Promise.all([
          repository.getSummary(customerId),
          repository.getHistory(customerId, EMPTY_CUSTOMER_ACTIVITY_FILTER),
        ]);
        set({ summary, history, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    setFilter: async (patch) => {
      const { customerId } = get();
      const filter = { ...get().filter, ...patch };
      set({ filter });
      if (!customerId) {
        return;
      }
      try {
        const history = await repository.getHistory(customerId, filter);
        set({ history });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },
  }));
}

/** App-wide singleton store, wired to the real repository (`NullCustomerActivityRepository` today). */
export const useCustomerActivityStore = createCustomerActivityStore();
