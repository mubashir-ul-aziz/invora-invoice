import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

let mockStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    useInvoiceTypeStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { CustomInvoiceTypeScreen } from '../CustomInvoiceTypeScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<CustomInvoiceTypeScreen navigation={navigation as never} route={{} as never} />);
}

describe('CustomInvoiceTypeScreen', () => {
  beforeEach(() => {
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('defaults to item name, quantity, unit price and tax with the locked fields disabled', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('custom-field-itemName')).toBeTruthy());
    expect(view.getByTestId('custom-field-itemName').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('custom-field-itemName').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('custom-field-unitPrice').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('custom-field-quantity').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('custom-field-tax').props.accessibilityState.checked).toBe(true);
    expect(view.getByTestId('custom-field-sku').props.accessibilityState.checked).toBe(false);
  });

  it('toggling a field updates the live preview', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('custom-field-sku')).toBeTruthy());
    fireEvent.press(view.getByTestId('custom-field-sku'));

    await waitFor(() =>
      expect(view.getByTestId('custom-invoice-type-preview')).toHaveTextContent(/SKU/),
    );
  });

  it('cannot uncheck the always-included fields', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('custom-field-itemName')).toBeTruthy());
    fireEvent.press(view.getByTestId('custom-field-itemName'));

    expect(view.getByTestId('custom-field-itemName').props.accessibilityState.checked).toBe(true);
  });

  it('saves the chosen field selection as the "custom" invoice type and navigates back', async () => {
    const repo = new InMemoryBusinessRepository();
    mockStore = createInvoiceTypeStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('custom-field-sku')).toBeTruthy());
    fireEvent.press(view.getByTestId('custom-field-sku'));
    fireEvent.press(view.getByTestId('custom-field-tax'));

    fireEvent.press(view.getByTestId('save-custom-invoice-type'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const saved = mockStore.getState().selection;
    expect(saved?.invoiceTypeId).toBe('custom');
    expect(saved?.customFieldKeys).toEqual(['itemName', 'sku', 'quantity', 'unitPrice']);
    await expect(repo.getInvoiceTypeSelection()).resolves.toMatchObject({
      invoiceTypeId: 'custom',
    });
  });
});
