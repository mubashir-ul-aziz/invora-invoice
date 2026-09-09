import { InMemoryItemRepository } from '../InMemoryItemRepository';
import { EMPTY_ITEM_INPUT } from '@/domain/item/types';

describe('InMemoryItemRepository', () => {
  it('returns an empty list before anything is created', async () => {
    const repo = new InMemoryItemRepository();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('creates an item and returns it with an id and timestamps', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', defaultPrice: 10 });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Steel Pipe');
    expect(created.defaultPrice).toBe(10);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
  });

  it('lists created items sorted by name', async () => {
    const repo = new InMemoryItemRepository();
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Zebra Widget' });
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Apple Widget' });

    const items = await repo.list();
    expect(items.map((i) => i.name)).toEqual(['Apple Widget', 'Zebra Widget']);
  });

  it('reads a single item by id, and null for an unknown id', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });

    await expect(repo.getById(created.id)).resolves.toEqual(created);
    await expect(repo.getById('missing')).resolves.toBeNull();
  });

  it('updates an existing item, keeping its id and createdAt', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', defaultPrice: 10 });

    const updated = await repo.update(created.id, {
      ...EMPTY_ITEM_INPUT,
      name: 'Steel Tube',
      defaultPrice: 12,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.name).toBe('Steel Tube');
    expect(updated.defaultPrice).toBe(12);
  });

  it('throws when updating an item that does not exist', async () => {
    const repo = new InMemoryItemRepository();
    await expect(repo.update('missing', EMPTY_ITEM_INPUT)).rejects.toThrow();
  });

  it('deletes an item', async () => {
    const repo = new InMemoryItemRepository();
    const created = await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });

    await repo.delete(created.id);

    await expect(repo.getById(created.id)).resolves.toBeNull();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('deleting an unknown id is a harmless no-op', async () => {
    const repo = new InMemoryItemRepository();
    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });

  it('filters the list by search text and invoice type', async () => {
    const repo = new InMemoryItemRepository();
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', sku: 'STL-1', invoiceTypeId: 'weight' });
    await repo.create({ ...EMPTY_ITEM_INPUT, name: 'Wood Plank', sku: 'WD-1', invoiceTypeId: 'volume' });

    await expect(repo.list({ searchText: 'steel', invoiceTypeId: 'all' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: '', invoiceTypeId: 'volume' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'steel', invoiceTypeId: 'volume' })).resolves.toHaveLength(0);
  });

  it('starts from a seed array without sharing state with the caller', async () => {
    const seedItem = { ...EMPTY_ITEM_INPUT, name: 'Seeded' };
    const repo = new InMemoryItemRepository([
      { id: 's1', createdAt: 'now', updatedAt: 'now', ...seedItem },
    ]);
    const items = await repo.list();
    expect(items).toHaveLength(1);
    await repo.delete('s1');
    await expect(repo.list()).resolves.toEqual([]);
  });
});
