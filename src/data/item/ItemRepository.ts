import type { Item, ItemFilter, ItemInput } from '@/domain/item/types';

/**
 * The only door the state/controller layer is allowed to use to reach item
 * catalog data. Screens/components never import a concrete repository,
 * Drizzle table, or the sqlite client directly.
 *
 * `Item` rows are reusable catalog definitions only — never invoice history
 * (see `domain/item/types.ts`), so this interface never grows an
 * invoice-linkage method (e.g. "items on invoice X").
 */
export interface ItemRepository {
  /** Returns items matching the filter, sorted alphabetically by name. */
  list(filter?: ItemFilter): Promise<Item[]>;
  /** Returns a single item, or null if it doesn't exist (e.g. already deleted). */
  getById(id: string): Promise<Item | null>;
  create(input: ItemInput): Promise<Item>;
  update(id: string, input: ItemInput): Promise<Item>;
  delete(id: string): Promise<void>;
}
