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

/** One render per file — see the note in `CustomerDetailScreen.test.tsx`. */
describe('CustomerDetailScreen info', () => {
  it('displays customer info, conditional contact actions, and the calculated (zero) summary', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({
      ...EMPTY_CUSTOMER_INPUT,
      name: 'Acme Co',
      phone: '+15551234567',
    });
    mockCustomerStore = createCustomerStore(repo);

    const view = await render(
      <CustomerDetailScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    expect(view.getByTestId('action-call')).toBeTruthy();
    expect(view.getByTestId('action-whatsapp')).toBeTruthy();
    expect(view.queryByTestId('action-email')).toBeNull();
    expect(view.getByTestId('summary-billed')).toBeTruthy();
  });
});
