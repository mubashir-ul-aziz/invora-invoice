import { render, waitFor, fireEvent } from '@testing-library/react-native';
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

/** One submitting test per file — see the codebase-wide note on react-hook-form's async resolver. */
describe('EditInvoiceLineScreen save (edit existing)', () => {
  it('editing an existing catalog-sourced line keeps its itemId and updates the fields', async () => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemId: 'item_9', itemName: 'Widget', quantity: 1, unitPrice: 10 });

    const view = await render(
      <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex: 0 } } as never} />,
    );

    await waitFor(() => expect(view.getByDisplayValue('Widget')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-quantity'), '4');
    fireEvent.press(view.getByTestId('save-invoice-line'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(useInvoiceDraftStore.getState().items).toHaveLength(1);
    expect(useInvoiceDraftStore.getState().items[0].itemId).toBe('item_9');
    expect(useInvoiceDraftStore.getState().items[0].quantity).toBe(4);
  });
});
