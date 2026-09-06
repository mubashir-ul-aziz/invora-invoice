import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import type { Customer } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT } from '@/domain/invoice/types';
import type { Item } from '@/domain/item/types';
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

import { CreateInvoiceItemsScreen } from '../CreateInvoiceItemsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };

const CUSTOMER: Customer = {
  id: 'cust_1',
  name: 'Acme Co',
  phone: null,
  email: null,
  address: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ITEM: Item = {
  id: 'item_1',
  name: 'Steel Pipe',
  description: null,
  sku: null,
  unit: 'pcs',
  defaultPrice: 25,
  taxRate: null,
  weight: null,
  length: null,
  width: null,
  height: null,
  invoiceTypeId: 'general',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderScreen() {
  return render(<CreateInvoiceItemsScreen navigation={navigation as never} route={{} as never} />);
}

describe('CreateInvoiceItemsScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
  });

  it('shows a fallback state when no customer was selected', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('create-invoice-items-no-customer')).toBeTruthy());
  });

  it('shows the selected customer and an empty items state', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    expect(view.getByTestId('invoice-items-empty')).toBeTruthy();
  });

  it('adding a catalog item via the picker adds a defaulted line without extra navigation', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-add-item')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-add-item'));

    expect(navigation.navigate).toHaveBeenCalledWith('ItemList', { onSelectItem: expect.any(Function) });
    const { onSelectItem } = (navigation.navigate as jest.Mock).mock.calls[0][1];
    onSelectItem(ITEM);

    expect(useInvoiceDraftStore.getState().items).toHaveLength(1);
    expect(useInvoiceDraftStore.getState().items[0].itemName).toBe('Steel Pipe');
    expect(useInvoiceDraftStore.getState().items[0].unitPrice).toBe(25);
  });

  it('"+ Add custom line" navigates to EditInvoiceLine with a null index', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-add-manual-line')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-add-manual-line'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditInvoiceLine', { lineIndex: null });
  });

  it('tapping an existing line navigates to EditInvoiceLine with its index', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore.getState().addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget' });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-line-0')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-line-0'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditInvoiceLine', { lineIndex: 0 });
  });

  it('removing a line asks for confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore.getState().addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget' });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-line-0-delete')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-line-0-delete'));

    expect(useInvoiceDraftStore.getState().items).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it('blocks continuing with zero items', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-continue-to-review')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-continue-to-review'));

    expect(alertSpy).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('InvoiceReview');
    alertSpy.mockRestore();
  });

  it('continues to review once at least one item is added', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore.getState().addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', unitPrice: 10 });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-continue-to-review')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-continue-to-review'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceReview');
  });

  it('switching invoice type reconciles existing lines, clearing fields no longer in the type', async () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'dimension' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Box', length: 10, width: 5, height: 2 });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-type-picker-general')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-type-picker-general'));

    expect(useInvoiceDraftStore.getState().invoiceTypeId).toBe('general');
    expect(useInvoiceDraftStore.getState().items[0].length).toBeNull();
    expect(useInvoiceDraftStore.getState().items[0].width).toBeNull();
    expect(useInvoiceDraftStore.getState().items[0].height).toBeNull();
  });
});
