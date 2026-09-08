import { create } from 'zustand';

import { getDashboardRepository } from '@/data/container';
import type { DashboardRepository } from '@/data/dashboard/DashboardRepository';
import { summarizeDashboard } from '@/domain/dashboard/calculations';
import { EMPTY_DASHBOARD_SUMMARY, type DashboardSummary } from '@/domain/dashboard/types';

export type DashboardStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DashboardState {
  status: DashboardStatus;
  summary: DashboardSummary;
  error: string | null;
  load: () => Promise<void>;
}

/**
 * Dependencies resolved lazily (not at module-eval time) so tests can swap
 * the repository via `createDashboardStore` before anything touches the
 * database — same pattern as `invoiceStore`/`itemStore`.
 *
 * All dashboard arithmetic happens in `summarizeDashboard()`
 * (`domain/dashboard/calculations.ts`) — this store only fetches the raw
 * per-invoice entries and hands them to that one function, never sums
 * anything itself.
 */
export function createDashboardStore(dashboardRepository: DashboardRepository = getDashboardRepository()) {
  return create<DashboardState>((set) => ({
    status: 'idle',
    summary: EMPTY_DASHBOARD_SUMMARY,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const entries = await dashboardRepository.getInvoiceEntries();
        set({ summary: summarizeDashboard(entries), status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useDashboardStore = createDashboardStore();
