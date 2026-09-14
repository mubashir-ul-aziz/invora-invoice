import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

describe('EditCustomerScreen.save', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
  });

  it('saves the edited customer and navigates back, keeping the same id', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockStore = createCustomerStore(repo);

    const view = await render(
      <EditCustomerScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('field-name').props.value).toBe('Acme Co'));
    fireEvent.changeText(view.getByTestId('field-name'), 'Acme Corporation');
    fireEvent.press(view.getByTestId('save-customer'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const updated = await repo.getById(created.id);
    expect(updated?.name).toBe('Acme Corporation');
    expect(updated?.id).toBe(created.id);
  });
});
