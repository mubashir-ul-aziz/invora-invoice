import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCustomerStore } from '@/state/customerStore';
import { createCustomerActivityStore } from '@/state/customerActivityStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';

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

import { CustomerDetailScreen } from '../CustomerDetailScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(customerId: string) {
  return render(
    <CustomerDetailScreen
      navigation={navigation as never}
      route={{ params: { customerId } } as never}
    />,
  );
}

/**
 * Split across several files — one render/interaction per file — following
 * the same "overlapping act()" avoidance pattern Phase 4 established for
 * `CreateItemScreen`/`EditItemScreen`: this screen's effect awaits two
 * sequential async loads (customer, then activity), and a second `render()`
 * in the same file intermittently observed a corrupted view from the
 * previous test's now-resolved (but un-awaited-by-the-test) promise chain.
 * See `CustomerDetailScreen.comingSoon.test.tsx` and
 * `CustomerDetailScreen.navigation.test.tsx` for the rest of this screen's
 * coverage.
 */
describe('CustomerDetailScreen', () => {
  beforeEach(() => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
  });

  it('shows a not-found state for a missing customer id', async () => {
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository());
    const view = await renderScreen('missing');

    await waitFor(() => expect(view.getByTestId('customer-detail-not-found')).toBeTruthy());
  });
});
