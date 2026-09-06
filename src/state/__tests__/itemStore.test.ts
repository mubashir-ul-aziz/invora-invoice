import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import type { ItemRepository } from '@/data/item/ItemRepository';
import { EMPTY_ITEM_INPUT } from '@/domain/item/types';

import { createItemStore } from '../itemStore';

function failingRepository(): ItemRepository {
  return {
    list: () => Promise.reject(new Error('list failed')),
    getById: () => Promise.reject(new Error('getById failed')),
    create: () => Promise.reject(new Error('create failed')),
    update: () => Promise.reject(new Error('update failed')),
    delete: () => Promise.reject(new Error('delete failed')),
  };
}

describe('itemStore', () => {
  it('loads an empty list, then ready', async () => {
    const store = createItemStore(new InMemoryItemRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().items).toEqual([]);
  });

  it('create adds an item and refreshes the list', async () => {
    const store = createItemStore(new InMemoryItemRepository());

    await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe', defaultPrice: 10 });

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].name).toBe('Steel Pipe');
  });

  it('update edits an item and refreshes the list', async () => {
    const store = createItemStore(new InMemoryItemRepository());
    const created = await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });

    await store.getState().update(created.id, { ...EMPTY_ITEM_INPUT, name: 'Steel Tube' });

    expect(store.getState().items[0].name).toBe('Steel Tube');
  });

  it('remove deletes an item and refreshes the list', async () => {
    const store = createItemStore(new InMemoryItemRepository());
    const created = await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });

    await store.getState().remove(created.id);

    expect(store.getState().items).toEqual([]);
  });

  it('getById reads a single item without changing the loaded list', async () => {
    const store = createItemStore(new InMemoryItemRepository());
    const created = await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });

    await expect(store.getState().getById(created.id)).resolves.toEqual(created);
    await expect(store.getState().getById('missing')).resolves.toBeNull();
  });

  it('setFilter merges the filter and reloads matching items', async () => {
    const store = createItemStore(new InMemoryItemRepository());
    await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Steel Pipe' });
    await store.getState().create({ ...EMPTY_ITEM_INPUT, name: 'Wood Plank' });

    await store.getState().setFilter({ searchText: 'steel' });

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].name).toBe('Steel Pipe');
    expect(store.getState().filter.searchText).toBe('steel');
  });

  it('sets an error state when load fails', async () => {
    const store = createItemStore(failingRepository());

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('list failed');
  });
});
