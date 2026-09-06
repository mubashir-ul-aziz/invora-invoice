import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { createCustomerStore } from '@/state/customerStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createInvoiceStore } from '@/state/invoiceStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockCustomerStore: ReturnType<typeof createCustomerStore>;

jest.mock('@/state/invoiceStore', () => {
  const actual = jest.requireActual('@/state/invoiceStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
  };
});

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCustomerStore: (...args: unknown[]) => (mockCustomerStore as any)(...args),
  };
});

import { InvoiceDetailScreen } from '../InvoiceDetailScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: 'Thanks for your business',
    terms: 'Net 15',
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

function renderScreen(invoiceId: string) {
  return render(
    <InvoiceDetailScreen navigation={navigation as never} route={{ params: { invoiceId } } as never} />,
  );
}

describe('InvoiceDetailScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository());
  });

  it('shows a not-found state for a missing invoice', async () => {
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    const view = await renderScreen('missing');
    await waitFor(() => expect(view.getByTestId('invoice-detail-not-found')).toBeTruthy());
  });

  it('displays the invoice number, customer, items, totals, notes and terms', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    expect(view.getByText('Acme Co')).toBeTruthy();
    expect(view.getByText('Widget')).toBeTruthy();
    expect(view.getByText('Thanks for your business')).toBeTruthy();
    expect(view.getByText('Net 15')).toBeTruthy();
    expect(view.getByTestId('invoice-detail-status')).toBeTruthy();
  });

  it('navigates to Edit Invoice', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);
    await waitFor(() => expect(view.getByTestId('action-edit-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-edit-invoice'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditInvoice', { invoiceId: created.id });
  });

  it('still shows "coming soon" for Record Payment and Share/PDF (Phase 7/9 not built yet)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);
    await waitFor(() => expect(view.getByTestId('action-record-payment')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-record-payment'));
    fireEvent.press(view.getByTestId('action-share'));

    expect(alertSpy).toHaveBeenCalledTimes(2);
    alertSpy.mockRestore();
  });
});
