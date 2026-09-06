import { create } from 'zustand';

import type { ItemRepository } from '@/data/item/ItemRepository';
import { getItemRepository } from '@/data/container';
import { EMPTY_ITEM_FILTER, type Item, type ItemFilter, type ItemInput } from '@/domain/item/types';

export type ItemListStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ItemState {
  status: ItemListStatus;
  items: Item[];
  filter: ItemFilter;
  error: string | null;
  /** Merges a partial filter change (search text and/or invoice-type filter) and reloads. */
  setFilter: (patch: Partial<ItemFilter>) => Promise<void>;
  load: () => Promise<void>;
  getById: (id: string) => Promise<Item | null>;
  create: (input: ItemInput) => Promise<Item>;
  update: (id: string, input: ItemInput) => Promise<Item>;
  remove: (id: string) => Promise<void>;
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repository via `createItemStore` before anything touches the
 * database — same pattern as `businessCardStore`/`invoiceSettingsStore`.
 */
export function createItemStore(repository: ItemRepository = getItemRepository()) {
  return create<ItemState>((set, get) => ({
    status: 'idle',
    items: [],
    filter: EMPTY_ITEM_FILTER,
    error: null,

    setFilter: async (patch) => {
      set((state) => ({ filter: { ...state.filter, ...patch } }));
      await get().load();
    },

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const items = await repository.list(get().filter);
        set({ items, status: 'ready' });
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
export const useItemStore = createItemStore();
