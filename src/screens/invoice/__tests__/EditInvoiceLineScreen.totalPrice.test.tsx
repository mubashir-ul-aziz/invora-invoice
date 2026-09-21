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
describe('EditInvoiceLineScreen save (Total Item Price)', () => {
  it('saves an Area line priced by Total Item Price without requiring a unit price', async () => {
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'area' });

    const view = await render(
      <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex: null } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('field-itemName')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-itemName'), 'Patio slab');
    fireEvent.changeText(view.getByTestId('field-length'), '10');
    fireEvent.changeText(view.getByTestId('field-width'), '10');
    fireEvent.press(view.getByTestId('field-priceMode-total'));
    await waitFor(() => expect(view.getByTestId('field-totalPrice')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-totalPrice'), '900');
    fireEvent.press(view.getByTestId('save-invoice-line'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    const [saved] = useInvoiceDraftStore.getState().items;
    expect(saved.priceMode).toBe('total');
    expect(saved.totalPrice).toBe(900);
    expect(saved.unitPrice).toBe(0);
    expect(saved.length).toBe(10);
    expect(saved.width).toBe(10);
  });
});
