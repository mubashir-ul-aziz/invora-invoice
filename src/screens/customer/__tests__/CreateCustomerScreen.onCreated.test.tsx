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

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

/** One test per file — see the note in `CreateCustomerScreen.validation.test.tsx`. */
describe('CreateCustomerScreen onCreated', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('calls onCreated with the new customer instead of just closing, when provided', async () => {
    const repo = new InMemoryCustomerRepository();
    mockStore = createCustomerStore(repo);
    const onCreated = jest.fn();

    const view = await render(
      <CreateCustomerScreen
        navigation={navigation as never}
        route={{ params: { onCreated } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('save-customer')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-name'), 'Acme Co');
    fireEvent.press(view.getByTestId('save-customer'));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme Co' })),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
