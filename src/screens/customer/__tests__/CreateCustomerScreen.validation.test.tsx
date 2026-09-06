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

/**
 * One resolver-triggered submit per test file — see the note on
 * `CreateItemScreen.validation.test.tsx` (Phase 4) for the root cause this
 * avoids: an un-`act()`-wrapped `react-hook-form` async-resolver update
 * leaking into a later render/interaction in the same file.
 */
describe('CreateCustomerScreen validation', () => {
  beforeEach(() => {
    mockStore = createCustomerStore(new InMemoryCustomerRepository());
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('rejects an empty customer name', async () => {
    const view = await render(
      <CreateCustomerScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );
    await waitFor(() => expect(view.getByTestId('save-customer')).toBeTruthy());

    fireEvent.press(view.getByTestId('save-customer'));

    await waitFor(() => expect(view.getByTestId('field-name-error')).toBeTruthy());
  });
});
