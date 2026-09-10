import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { createCustomerStore } from '@/state/customerStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createPaymentStore } from '@/state/paymentStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockCustomerStore: ReturnType<typeof createCustomerStore>;
let mockPaymentStore: ReturnType<typeof createPaymentStore>;

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

jest.mock('@/state/paymentStore', () => {
  const actual = jest.requireActual('@/state/paymentStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePaymentStore: (...args: unknown[]) => (mockPaymentStore as any)(...args),
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
    mockPaymentStore = createPaymentStore(new InMemoryPaymentRepository());
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
    await waitFor(() => expect(view.getByTestId('invoice-detail-menu')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-detail-menu'));
    await waitFor(() => expect(view.getByTestId('action-edit-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-edit-invoice'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditInvoice', { invoiceId: created.id });
  });

  it('Share / PDF now navigates to the Invoice PDF Preview screen (Phase 9)', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);
    await waitFor(() => expect(view.getByTestId('action-share')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-share'));

    expect(navigation.navigate).toHaveBeenCalledWith('InvoicePdfPreview', { invoiceId: created.id });
  });

  it('Record Payment now navigates for real (Phase 7) instead of alerting', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);
    await waitFor(() => expect(view.getByTestId('action-record-payment')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-record-payment'));

    expect(navigation.navigate).toHaveBeenCalledWith('RecordPayment', { invoiceId: created.id });
  });

  it('shows Call/Email/Website/Directions actions for the invoice’s customer', async () => {
    const customers = new InMemoryCustomerRepository();
    const customer = await customers.create({
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: null,
    });
    mockCustomerStore = createCustomerStore(customers);

    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput({ customerId: customer.id }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('action-call')).toBeTruthy());
    expect(view.getByTestId('action-email')).toBeTruthy();
    expect(view.getByTestId('action-website')).toBeTruthy();
    expect(view.getByTestId('action-directions')).toBeTruthy();
  });

  it('shows an "invoice payment summary" section with no payments recorded yet', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await renderScreen(created.id);
    await waitFor(() => expect(view.getByTestId('invoice-detail-payment-summary')).toBeTruthy());
    expect(view.getByTestId('invoice-detail-no-payments')).toBeTruthy();
    expect(view.getByTestId('payment-summary-remaining')).toBeTruthy();
  });
});
