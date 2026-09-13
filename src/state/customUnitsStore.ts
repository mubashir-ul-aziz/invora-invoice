import { create } from 'zustand';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { getBusinessRepository } from '@/data/container';
import { EMPTY_CUSTOM_UNITS, type CustomUnitsMap, type UnitFieldKind } from '@/domain/invoiceType/customUnits';

export type CustomUnitsStatus = 'idle' | 'loading' | 'saving' | 'ready' | 'error';

interface CustomUnitsState {
  status: CustomUnitsStatus;
  units: CustomUnitsMap;
  error: string | null;
  load: () => Promise<void>;
  addUnit: (kind: UnitFieldKind, label: string) => Promise<CustomUnitsMap>;
}

/**
 * Business-added units for the four unit dropdowns (generic/weight/length/
 * time) — see `domain/invoiceType/customUnits.ts`. Same lazily-resolved
 * repository pattern as `invoiceTypeStore`, so tests can swap it before
 * anything touches the database.
 */
export function createCustomUnitsStore(repository: BusinessRepository = getBusinessRepository()) {
  return create<CustomUnitsState>((set, get) => ({
    status: 'idle',
    units: { ...EMPTY_CUSTOM_UNITS },
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const units = await repository.getCustomUnits();
        set({ units, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    addUnit: async (kind, label) => {
      set({ status: 'saving', error: null });
      try {
        const units = await repository.addCustomUnit(kind, label);
        set({ units, status: 'ready' });
        return units;
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
        return get().units;
      }
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repository. */
export const useCustomUnitsStore = createCustomUnitsStore();
