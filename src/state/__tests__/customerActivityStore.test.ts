import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import type { CustomerActivityRepository } from '@/data/customerActivity/CustomerActivityRepository';
import { EMPTY_CUSTOMER_BALANCE_SUMMARY, type CustomerActivityEntry } from '@/domain/customer/types';

import { createCustomerActivityStore } from '../customerActivityStore';

const entries: CustomerActivityEntry[] = [
  {
    id: 'inv1',
    type: 'invoice',
    date: '2026-01-01T00:00:00.000Z',
    title: 'Invoice INV-1',
    amount: 100,
    status: 'unpaid',
  },
  {
    id: 'pay1',
    type: 'payment',
    date: '2026-01-05T00:00:00.000Z',
    title: 'Payment via Cash',
    amount: 40,
    status: 'cash',
  },
];

function failingRepository(): CustomerActivityRepository {
  return {
    getSummary: () => Promise.reject(new Error('summary failed')),
    getHistory: () => Promise.reject(new Error('history failed')),
  };
}

describe('customerActivityStore', () => {
  it('loads the summary and history for a customer', async () => {
    const store = createCustomerActivityStore(new InMemoryCustomerActivityRepository({ c1: entries }));
    expect(store.getState().status).toBe('idle');

    await store.getState().load('c1');

    expect(store.getState().status).toBe('ready');
    expect(store.getState().summary.totalBilled).toBe(100);
    expect(store.getState().history.map((e) => e.id)).toEqual(['pay1', 'inv1']);
  });

  it('returns the empty summary for a customer with no activity', async () => {
    const store = createCustomerActivityStore(new InMemoryCustomerActivityRepository());

    await store.getState().load('unknown');

    expect(store.getState().summary).toEqual(EMPTY_CUSTOMER_BALANCE_SUMMARY);
    expect(store.getState().history).toEqual([]);
  });

  it('setFilter merges the filter and re-fetches history for the current customer', async () => {
    const store = createCustomerActivityStore(new InMemoryCustomerActivityRepository({ c1: entries }));
    await store.getState().load('c1');

    await store.getState().setFilter({ type: 'invoice' });

    expect(store.getState().history.map((e) => e.id)).toEqual(['inv1']);
    expect(store.getState().filter.type).toBe('invoice');
  });

  it('resets the filter to "all" on each new load', async () => {
    const store = createCustomerActivityStore(new InMemoryCustomerActivityRepository({ c1: entries }));
    await store.getState().load('c1');
    await store.getState().setFilter({ type: 'payment' });

    await store.getState().load('c1');

    expect(store.getState().filter.type).toBe('all');
    expect(store.getState().history).toHaveLength(2);
  });

  it('sets an error state when load fails', async () => {
    const store = createCustomerActivityStore(failingRepository());

    await store.getState().load('c1');

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('summary failed');
  });
});
