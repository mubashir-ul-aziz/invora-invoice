import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { EMPTY_INVOICE_ITEM_INPUT } from '@/domain/invoice/types';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
  };
});

import { EditInvoiceLineScreen } from '../EditInvoiceLineScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen(lineIndex: number | null) {
  return render(
    <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex } } as never} />,
  );
}

describe('EditInvoiceLineScreen', () => {
  beforeEach(() => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
  });

  it('starts blank when adding a line, with only the fields the invoice type includes', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    const view = await renderScreen(null);

    await waitFor(() => expect(view.getByTestId('field-itemName')).toBeTruthy());
    expect(view.getByTestId('field-quantity')).toBeTruthy();
    expect(view.queryByTestId('field-weight')).toBeNull();
    expect(view.queryByTestId('remove-invoice-line')).toBeNull();
  });

  it('shows only Weight (not Length/Width/Height) for a Weight-type invoice', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'weight' });
    const view = await renderScreen(null);

    await waitFor(() => expect(view.getByTestId('field-weight')).toBeTruthy());
    expect(view.queryByTestId('field-length')).toBeNull();
  });

  it('pre-fills an existing line when editing, and shows the Remove action', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 3, unitPrice: 12 });
    const view = await renderScreen(0);

    await waitFor(() => expect(view.getByDisplayValue('Widget')).toBeTruthy());
    expect(view.getByDisplayValue('3')).toBeTruthy();
    expect(view.getByDisplayValue('12')).toBeTruthy();
    expect(view.getByTestId('remove-invoice-line')).toBeTruthy();
  });
});
