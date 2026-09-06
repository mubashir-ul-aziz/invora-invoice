import { Alert } from 'react-native';
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

describe('EditInvoiceLineScreen remove', () => {
  it('removes the line after confirming and goes back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget' });

    const view = await render(
      <EditInvoiceLineScreen navigation={navigation as never} route={{ params: { lineIndex: 0 } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('remove-invoice-line')).toBeTruthy());
    fireEvent.press(view.getByTestId('remove-invoice-line'));

    expect(useInvoiceDraftStore.getState().items).toHaveLength(0);
    expect(navigation.goBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
