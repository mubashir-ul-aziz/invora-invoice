import { itemMatchesFilter, sortItems } from '../filtering';
import { EMPTY_ITEM_FILTER, type Item } from '../types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'Steel Pipe',
    description: 'Galvanized steel pipe',
    sku: 'STL-001',
    unit: 'pcs',
    defaultPrice: 10,
    taxRate: null,
    weight: null,
    length: null,
    width: null,
    height: null,
    invoiceTypeId: 'general',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('itemMatchesFilter', () => {
  it('matches everything with the empty filter', () => {
    expect(itemMatchesFilter(makeItem(), EMPTY_ITEM_FILTER)).toBe(true);
  });

  it('matches search text against the name (case-insensitive)', () => {
    expect(itemMatchesFilter(makeItem({ name: 'Steel Pipe' }), { ...EMPTY_ITEM_FILTER, searchText: 'steel' })).toBe(true);
    expect(itemMatchesFilter(makeItem({ name: 'Steel Pipe' }), { ...EMPTY_ITEM_FILTER, searchText: 'copper' })).toBe(false);
  });

  it('matches search text against the SKU', () => {
    expect(itemMatchesFilter(makeItem({ sku: 'STL-001' }), { ...EMPTY_ITEM_FILTER, searchText: 'stl-001' })).toBe(true);
  });

  it('matches search text against the description', () => {
    expect(
      itemMatchesFilter(makeItem({ description: 'Galvanized steel pipe' }), {
        ...EMPTY_ITEM_FILTER,
        searchText: 'galvanized',
      }),
    ).toBe(true);
  });

  it('does not throw on a null sku/description', () => {
    expect(
      itemMatchesFilter(makeItem({ sku: null, description: null }), {
        ...EMPTY_ITEM_FILTER,
        searchText: 'steel',
      }),
    ).toBe(true);
  });

  it('filters by invoice type', () => {
    const item = makeItem({ invoiceTypeId: 'weight' });
    expect(itemMatchesFilter(item, { ...EMPTY_ITEM_FILTER, invoiceTypeId: 'weight' })).toBe(true);
    expect(itemMatchesFilter(item, { ...EMPTY_ITEM_FILTER, invoiceTypeId: 'dimension' })).toBe(false);
    expect(itemMatchesFilter(item, { ...EMPTY_ITEM_FILTER, invoiceTypeId: 'all' })).toBe(true);
  });

  it('applies both search text and invoice type together', () => {
    const item = makeItem({ name: 'Steel Pipe', invoiceTypeId: 'weight' });
    expect(
      itemMatchesFilter(item, { searchText: 'steel', invoiceTypeId: 'weight' }),
    ).toBe(true);
    expect(
      itemMatchesFilter(item, { searchText: 'steel', invoiceTypeId: 'dimension' }),
    ).toBe(false);
  });
});

describe('sortItems', () => {
  it('sorts alphabetically by name without mutating the input array', () => {
    const items = [makeItem({ id: '1', name: 'Zebra' }), makeItem({ id: '2', name: 'Apple' })];
    const sorted = sortItems(items);
    expect(sorted.map((i) => i.name)).toEqual(['Apple', 'Zebra']);
    expect(items.map((i) => i.name)).toEqual(['Zebra', 'Apple']);
  });
});
