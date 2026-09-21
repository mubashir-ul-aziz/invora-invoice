import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryItemRepository } from '@/data/item/InMemoryItemRepository';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { createItemStore } from '@/state/itemStore';

let mockItemStore: ReturnType<typeof createItemStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/itemStore', () => {
  const actual = jest.requireActual('@/state/itemStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useItemStore: (...args: unknown[]) => (mockItemStore as any)(...args),
  };
});

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
  };
});

import { CreateItemScreen } from '../CreateItemScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

/** Non-submitting checks only (see the codebase-wide note on react-hook-form's async resolver). */
describe('CreateItemScreen price mode toggle', () => {
  beforeEach(() => {
    mockItemStore = createItemStore(new InMemoryItemRepository());
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
  });

  it('offers Unit Price / Total Item Price, defaulting to Unit Price, and relabels the same price field', async () => {
    const view = await render(
      <CreateItemScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );
    await waitFor(() => expect(view.getByTestId('field-priceMode')).toBeTruthy());

    expect(view.getByTestId('field-priceMode-unit').props.accessibilityState.selected).toBe(true);
    expect(view.getByText(/Unit Price \*|Price per .* unit \*/)).toBeTruthy();

    await fireEvent.press(view.getByTestId('field-priceMode-total'));
    await waitFor(() => expect(view.getByText('Total Item Price *')).toBeTruthy());
    expect(view.getByTestId('field-priceMode-total').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('field-defaultPrice')).toBeTruthy();
  });

  it('keeps the measurement fields in Total Item Price mode', async () => {
    const view = await render(
      <CreateItemScreen navigation={navigation as never} route={{ params: undefined } as never} />,
    );
    await waitFor(() => expect(view.getByTestId('field-invoiceTypeId')).toBeTruthy());
    await fireEvent.press(view.getByTestId('field-invoiceTypeId-area'));
    await fireEvent.press(view.getByTestId('field-priceMode-total'));

    await waitFor(() => expect(view.getByTestId('field-length')).toBeTruthy());
    expect(view.getByTestId('field-width')).toBeTruthy();
  });
});
