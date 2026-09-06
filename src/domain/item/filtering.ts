import type { Item, ItemFilter } from './types';

/**
 * Pure search/filter predicate shared by `InMemoryItemRepository` (tests
 * that run without SQLite) and as the documented contract
 * `SqliteItemRepository` reproduces with SQL `LIKE`/`=` — one definition of
 * "what counts as a match" instead of two implementations drifting apart.
 */
export function itemMatchesFilter(item: Item, filter: ItemFilter): boolean {
  if (filter.invoiceTypeId !== 'all' && item.invoiceTypeId !== filter.invoiceTypeId) {
    return false;
  }
  const query = filter.searchText.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = [item.name, item.sku, item.description]
    .filter((value): value is string => !!value)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Canonical sort order for the Items List screen: alphabetical by name. */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}
