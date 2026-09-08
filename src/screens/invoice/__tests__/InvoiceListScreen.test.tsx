import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;
let mockInvoiceSettingsStore: ReturnType<typeof createInvoiceSettingsStore>;

jest.mock('@/state/invoiceStore', () => {
  const actual = jest.requireActual('@/state/invoiceStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
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

jest.mock('@/state/invoiceSettingsStore', () => {
  const actual = jest.requireActual('@/state/invoiceSettingsStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceSettingsStore: (...args: unknown[]) => (mockInvoiceSettingsStore as any)(...args),
  };
});

import { InvoiceListScreen } from '../InvoiceListScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

function renderScreen(params?: Record<string, unknown>) {
  return render(<InvoiceListScreen navigation={navigation as never} route={{ params } as never} />);
}

describe('InvoiceListScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    mockInvoiceSettingsStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
  });

  it('shows an empty-state prompt when no invoices exist', async () => {
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-list-empty')).toBeTruthy());
  });

  it('lists saved invoices with their number and customer', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    expect(view.getByText('Acme Co')).toBeTruthy();
  });

  it('filters the list by search text', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ customerName: 'Acme Co' }));
    await invoices.create('INV-2', makeInput({ customerName: 'Globex' }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('invoice-search'), 'globex');

    await waitFor(() => expect(view.queryByText('INV-1')).toBeNull());
    expect(view.getByText('INV-2')).toBeTruthy();
  });

  it('starting a new invoice seeds the draft and opens the customer picker', async () => {
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-create-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-invoice'));

    expect(useInvoiceDraftStore.getState().mode).toBe('create');
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList', {
      onSelectCustomer: expect.any(Function),
    });
  });

  it('navigates to Invoice Detail when tapping a row', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`invoice-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`invoice-row-${created.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: created.id });
  });

  it('picker mode (Phase 7): calls onSelectInvoice and goes back instead of opening Invoice Detail', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const onSelectInvoice = jest.fn();
    const view = await renderScreen({ onSelectInvoice });

    await waitFor(() => expect(view.getByTestId(`invoice-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`invoice-row-${created.id}`));

    expect(onSelectInvoice).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('InvoiceDetail', expect.anything());
  });

  it('scopes the list to one customer via route.params.customerId, and clears the scope on unmount', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ customerId: 'cust_1', customerName: 'Acme Co' }));
    await invoices.create('INV-2', makeInput({ customerId: 'cust_2', customerName: 'Globex' }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen({ customerId: 'cust_1' });

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    expect(view.queryByText('INV-2')).toBeNull();
    expect(mockInvoiceStore.getState().filter.customerId).toBe('cust_1');

    await act(async () => {
      view.unmount();
    });
    await waitFor(() => expect(mockInvoiceStore.getState().filter.customerId).toBeUndefined());
  });
});
