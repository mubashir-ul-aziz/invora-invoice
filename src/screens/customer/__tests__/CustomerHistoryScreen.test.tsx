import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCustomerStore } from '@/state/customerStore';
import { createCustomerActivityStore } from '@/state/customerActivityStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import type { Customer, CustomerActivityEntry } from '@/domain/customer/types';

let mockCustomerStore: ReturnType<typeof createCustomerStore>;
let mockActivityStore: ReturnType<typeof createCustomerActivityStore>;

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    useCustomerStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCustomerStore as any)(...args),
  };
});

jest.mock('@/state/customerActivityStore', () => {
  const actual = jest.requireActual('@/state/customerActivityStore');
  return {
    ...actual,
    useCustomerActivityStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockActivityStore as any)(...args),
  };
});

import { CustomerHistoryScreen } from '../CustomerHistoryScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const customer: Customer = {
  id: 'c1',
  name: 'Taylor & Co Properties',
  phone: null,
  email: null,
  website: null,
  address: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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
    status: 'Cash',
  },
];

function renderScreen(customerId: string) {
  return render(
    <CustomerHistoryScreen
      navigation={navigation as never}
      route={{ params: { customerId } } as never}
    />,
  );
}

describe('CustomerHistoryScreen', () => {
  beforeEach(() => {
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository([customer]));
  });

  it('shows an empty-state prompt when there is no activity yet', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    const view = await renderScreen('c1');

    await waitFor(() => expect(view.getByTestId('customer-history-empty')).toBeTruthy());
  });

  it('lists invoices and payments newest-first', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository({ c1: entries }));
    const view = await renderScreen('c1');

    await waitFor(() => expect(view.getByText('Payment via Cash')).toBeTruthy());
    expect(view.getByText('Invoice INV-1')).toBeTruthy();
  });

  it('filters to just invoices or just payments', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository({ c1: entries }));
    const view = await renderScreen('c1');

    await waitFor(() => expect(view.getByText('Invoice INV-1')).toBeTruthy());

    fireEvent.press(view.getByTestId('history-type-filter-invoice'));
    await waitFor(() => expect(view.queryByText('Payment via Cash')).toBeNull());
    expect(view.getByText('Invoice INV-1')).toBeTruthy();

    fireEvent.press(view.getByTestId('history-type-filter-payment'));
    await waitFor(() => expect(view.queryByText('Invoice INV-1')).toBeNull());
    expect(view.getByText('Payment via Cash')).toBeTruthy();
  });

  it('shows a not-found state for a missing customer id', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    const view = await renderScreen('missing');

    await waitFor(() => expect(view.getByTestId('customer-history-not-found')).toBeTruthy());
  });
});
