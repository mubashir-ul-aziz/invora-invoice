import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import type { CustomerActivityRepository } from '@/data/customerActivity/CustomerActivityRepository';
import type { CustomerActivityEntry } from '@/domain/customer/types';

import { createCustomerBalancesStore } from '../customerBalancesStore';

const entriesByCustomer: Record<string, CustomerActivityEntry[]> = {
  c1: [
    { id: 'i1', type: 'invoice', date: '2026-01-01T00:00:00.000Z', title: 'Invoice INV-1', amount: 100, status: 'overdue' },
  ],
  c2: [
    { id: 'i2', type: 'invoice', date: '2026-01-01T00:00:00.000Z', title: 'Invoice INV-2', amount: 50, status: 'unpaid' },
    { id: 'p2', type: 'payment', date: '2026-01-02T00:00:00.000Z', title: 'Payment via Cash', amount: 50, status: 'cash' },
  ],
};

function failingRepository(): CustomerActivityRepository {
  return {
    getSummary: () => Promise.reject(new Error('summary failed')),
    getHistory: () => Promise.reject(new Error('history failed')),
  };
}

describe('customerBalancesStore', () => {
  it('loads a balance summary per customer id', async () => {
    const store = createCustomerBalancesStore(new InMemoryCustomerActivityRepository(entriesByCustomer));
    expect(store.getState().status).toBe('idle');

    await store.getState().loadMany(['c1', 'c2']);

    expect(store.getState().status).toBe('ready');
    expect(store.getState().balances.c1.overdueAmount).toBe(100);
    expect(store.getState().balances.c2.outstanding).toBe(0);
  });

  it('replaces the cache on each call rather than merging', async () => {
    const store = createCustomerBalancesStore(new InMemoryCustomerActivityRepository(entriesByCustomer));
    await store.getState().loadMany(['c1', 'c2']);

    await store.getState().loadMany(['c1']);

    expect(Object.keys(store.getState().balances)).toEqual(['c1']);
  });

  it('sets an error state when a lookup fails', async () => {
    const store = createCustomerBalancesStore(failingRepository());

    await store.getState().loadMany(['c1']);

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('summary failed');
  });
});
