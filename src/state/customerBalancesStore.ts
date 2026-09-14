import { create } from 'zustand';

import type { CustomerActivityRepository } from '@/data/customerActivity/CustomerActivityRepository';
import { getCustomerActivityRepository } from '@/data/container';
import type { CustomerBalanceSummary } from '@/domain/customer/types';

export type CustomerBalancesStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CustomerBalancesState {
  status: CustomerBalancesStatus;
  balances: Record<string, CustomerBalanceSummary>;
  error: string | null;
  /** Fetches (and replaces the cache with) the balance summary for each given customer id. */
  loadMany: (customerIds: string[]) => Promise<void>;
}

/**
 * Feeds the Customer List screen's per-row outstanding/overdue badge and its
 * "Total Outstanding"/"Settled Ratio" summary strip — real numbers derived
 * from `CustomerActivityRepository` (the same abstraction Customer
 * Detail/History already read from, see its doc comment), never invented.
 * One `getSummary` call per customer since the repository has no batch
 * method yet; fine at MVP list sizes, and swapping in a batched query later
 * is a change behind this same store, not the screen.
 */
export function createCustomerBalancesStore(
  repository: CustomerActivityRepository = getCustomerActivityRepository(),
) {
  return create<CustomerBalancesState>((set) => ({
    status: 'idle',
    balances: {},
    error: null,

    loadMany: async (customerIds) => {
      set({ status: 'loading', error: null });
      try {
        const entries = await Promise.all(
          customerIds.map(async (id) => [id, await repository.getSummary(id)] as const),
        );
        set({ balances: Object.fromEntries(entries), status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },
  }));
}

/** App-wide singleton store, wired to the real repository. */
export const useCustomerBalancesStore = createCustomerBalancesStore();
