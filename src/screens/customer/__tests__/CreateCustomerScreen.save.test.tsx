import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCustomerStore } from '@/state/customerStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';

let mockStore: ReturnType<typeof createCustomerStore>;

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    useCustomerStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { CreateCustomerScreen } from '../CreateCustomerScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

/** One test per file — see the note in `CreateCustomerScreen.validation.test.tsx`. */
describe('CreateCustomerScreen.save', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
    (navigation.replace as jest.Mock).mockClear();
  });

  it('creates the customer and replaces this screen with Customer Detail', async () => {
    const repo = new InMemoryCustomerRepository();
    mockStore = createCustomerStore(repo);

    const view = await render(
      <CreateCustomerScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('save-customer')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-name'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-phone'), '+15551234567');
    fireEvent.press(view.getByTestId('save-customer'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
    const customers = await repo.list();
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Acme Co');
    expect(customers[0].phone).toBe('+15551234567');
    expect(navigation.replace).toHaveBeenCalledWith('CustomerDetail', { customerId: customers[0].id });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
