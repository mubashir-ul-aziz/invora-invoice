import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createPaymentStore } from '@/state/paymentStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockPaymentStore: ReturnType<typeof createPaymentStore>;

jest.mock('@/state/invoiceStore', () => {
  const actual = jest.requireActual('@/state/invoiceStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
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

import { RecordPaymentScreen } from '../RecordPaymentScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn() };

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 10, unitPrice: 100 }],
    ...overrides,
  };
}

function renderScreen(invoiceId: string) {
  return render(
    <RecordPaymentScreen navigation={navigation as never} route={{ params: { invoiceId } } as never} />,
  );
}

describe('RecordPaymentScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.popToTop as jest.Mock).mockClear();
  });

  it('shows a not-found state for a missing invoice', async () => {
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    mockPaymentStore = createPaymentStore(new InMemoryPaymentRepository());

    const view = await renderScreen('missing');
    await waitFor(() => expect(view.getByTestId('record-payment-not-found')).toBeTruthy());
  });

  it('displays the invoice header and a payment summary with no payments yet', async () => {
    const invoices = new InMemoryInvoiceRepository();
    // 10 x 100 = 1000, matching the brief's worked example.
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    mockPaymentStore = createPaymentStore(new InMemoryPaymentRepository());

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    expect(view.getByText('Acme Co')).toBeTruthy();
    expect(view.getByTestId('payment-summary-total')).toBeTruthy();
    expect(view.getByTestId('payment-summary-remaining')).toBeTruthy();
  });

  it('leaves the amount field blank after a partial payment, even though a balance remains', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput()); // grand total 1000
    const payments = new InMemoryPaymentRepository();
    await payments.create({
      invoiceId: created.id,
      invoiceNumber: 'INV-1',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 300,
      paymentDate: '2026-06-05',
      method: 'cash',
      reference: null,
      notes: null,
    });
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    mockPaymentStore = createPaymentStore(payments);

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('payment-summary-remaining')).toBeTruthy());
    expect(view.getByTestId('field-amount').props.value).toBe('');
  });
});
