import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCustomerStore } from '@/state/customerStore';
import { createCustomerActivityStore } from '@/state/customerActivityStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';

let mockStore: ReturnType<typeof createCustomerStore>;
let mockActivityStore: ReturnType<typeof createCustomerActivityStore>;

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    useCustomerStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
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

import { EditCustomerScreen } from '../EditCustomerScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(customerId: string) {
  return render(
    <EditCustomerScreen
      navigation={navigation as never}
      route={{ params: { customerId } } as never}
    />,
  );
}

describe('EditCustomerScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
  });

  it('shows a not-found state for a missing customer id', async () => {
    mockStore = createCustomerStore(new InMemoryCustomerRepository());
    const view = await renderScreen('missing');

    await waitFor(() => expect(view.getByTestId('edit-customer-not-found')).toBeTruthy());
  });

  it('pre-fills the form with the existing customer', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({
      ...EMPTY_CUSTOMER_INPUT,
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
    });
    mockStore = createCustomerStore(repo);
    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('field-name').props.value).toBe('Acme Co'));
    expect(view.getByTestId('field-phone').props.value).toBe('+15551234567');
    expect(view.getByTestId('field-email').props.value).toBe('ap@acme.test');
  });
});
