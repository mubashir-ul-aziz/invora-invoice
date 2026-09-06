import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
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
describe('EditInvoiceLineScreen save (add)', () => {
  it('adding a new manual line appends it to the draft and goes back', async () => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });

    const view = await render(
      <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex: null } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('field-itemName')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-itemName'), 'Custom Service');
    fireEvent.changeText(view.getByTestId('field-unitPrice'), '150');
    fireEvent.press(view.getByTestId('save-invoice-line'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(useInvoiceDraftStore.getState().items).toHaveLength(1);
    expect(useInvoiceDraftStore.getState().items[0].itemName).toBe('Custom Service');
    expect(useInvoiceDraftStore.getState().items[0].unitPrice).toBe(150);
    expect(useInvoiceDraftStore.getState().items[0].itemId).toBeNull();
  });
});
