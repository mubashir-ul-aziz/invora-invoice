import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import type { CustomerRepository } from '@/data/customer/CustomerRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';

import { createCustomerStore } from '../customerStore';

function failingRepository(): CustomerRepository {
  return {
    list: () => Promise.reject(new Error('list failed')),
    getById: () => Promise.reject(new Error('getById failed')),
    create: () => Promise.reject(new Error('create failed')),
    update: () => Promise.reject(new Error('update failed')),
    delete: () => Promise.reject(new Error('delete failed')),
  };
}

describe('customerStore', () => {
  it('loads an empty list, then ready', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().customers).toEqual([]);
  });

  it('create adds a customer and refreshes the list', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());

    await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    expect(store.getState().customers).toHaveLength(1);
    expect(store.getState().customers[0].name).toBe('Acme Co');
  });

  it('update edits a customer and refreshes the list', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());
    const created = await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    await store.getState().update(created.id, { ...EMPTY_CUSTOMER_INPUT, name: 'Acme Corporation' });

    expect(store.getState().customers[0].name).toBe('Acme Corporation');
  });

  it('remove deletes a customer and refreshes the list', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());
    const created = await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    await store.getState().remove(created.id);

    expect(store.getState().customers).toEqual([]);
  });

  it('getById reads a single customer without changing the loaded list', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());
    const created = await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    await expect(store.getState().getById(created.id)).resolves.toEqual(created);
    await expect(store.getState().getById('missing')).resolves.toBeNull();
  });

  it('setFilter merges the filter and reloads matching customers', async () => {
    const store = createCustomerStore(new InMemoryCustomerRepository());
    await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    await store.getState().create({ ...EMPTY_CUSTOMER_INPUT, name: 'Globex Inc' });

    await store.getState().setFilter({ searchText: 'acme' });

    expect(store.getState().customers).toHaveLength(1);
    expect(store.getState().customers[0].name).toBe('Acme Co');
    expect(store.getState().filter.searchText).toBe('acme');
  });

  it('sets an error state when load fails', async () => {
    const store = createCustomerStore(failingRepository());

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('list failed');
  });
});
