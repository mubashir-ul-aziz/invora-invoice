import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createItemStore } from '@/state/itemStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

let mockItemStore: ReturnType<typeof createItemStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/itemStore', () => {
  const actual = jest.requireActual('@/state/itemStore');
  return {
    ...actual,
    useItemStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockItemStore as any)(...args),
  };
});

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    useInvoiceTypeStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockInvoiceTypeStore as any)(...args),
  };
});

import { CreateItemScreen } from '../CreateItemScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(
    <CreateItemScreen navigation={navigation as never} route={{ params: undefined } as never} />,
  );
}

describe('CreateItemScreen', () => {
  beforeEach(() => {
    mockItemStore = createItemStore(new InMemoryItemRepository());
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('shows the pricing-method-specific fields only for weight/volume methods', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-invoiceTypeId')).toBeTruthy());

    expect(view.queryByTestId('field-weight')).toBeNull();
    expect(view.queryByTestId('field-length')).toBeNull();

    fireEvent.press(view.getByTestId('field-invoiceTypeId-weight'));
    await waitFor(() => expect(view.getByTestId('field-weight')).toBeTruthy());
    expect(view.getByTestId('field-weightUnit')).toBeTruthy();
    expect(view.queryByTestId('field-length')).toBeNull();

    fireEvent.press(view.getByTestId('field-invoiceTypeId-volume'));
    await waitFor(() => expect(view.getByTestId('field-length')).toBeTruthy());
    expect(view.getByTestId('field-width')).toBeTruthy();
    expect(view.getByTestId('field-height')).toBeTruthy();
    expect(view.getByTestId('field-lengthUnit')).toBeTruthy();
    expect(view.queryByTestId('field-weight')).toBeNull();
  });
});
