import { itemMatchesFilter, sortItems } from '@/domain/item/filtering';
import { EMPTY_ITEM_FILTER, type Item, type ItemFilter, type ItemInput } from '@/domain/item/types';
import { generateLocalId } from '@/lib/id';

import type { ItemRepository } from './ItemRepository';

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the Items UI/state layer before the SQLite-backed repository
 * exists, and kept afterwards for fast Jest tests (same role as
 * `InMemoryBusinessRepository` in earlier phases).
 */
export class InMemoryItemRepository implements ItemRepository {
  private items: Item[];

  constructor(seed: Item[] = []) {
    this.items = [...seed];
  }

  async list(filter: ItemFilter = EMPTY_ITEM_FILTER): Promise<Item[]> {
    return sortItems(this.items.filter((item) => itemMatchesFilter(item, filter)));
  }

  async getById(id: string): Promise<Item | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async create(input: ItemInput): Promise<Item> {
    const now = new Date().toISOString();
    const item: Item = { id: generateLocalId('item_'), ...input, createdAt: now, updatedAt: now };
    this.items.push(item);
    return item;
  }

  async update(id: string, input: ItemInput): Promise<Item> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Item not found: ${id}`);
    }
    const updated: Item = {
      ...this.items[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.items[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }
}
