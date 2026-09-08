import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { PaymentBackedPaymentTotalsRepository } from '@/data/paymentTotals/PaymentBackedPaymentTotalsRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createCustomerStore } from '@/state/customerStore';
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
    notes: null,
    terms: null,
    // 10 x 100 = grand total 1000, matching the brief's worked example.
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 10, unitPrice: 100 }],
    ...overrides,
  };
}

function renderScreen(invoiceId: string) {
  return render(
    <InvoiceDetailScreen navigation={navigation as never} route={{ params: { invoiceId } } as never} />,
  );
}

describe('InvoiceDetailScreen invoice payment summary', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository());
  });

  it('shows Paid/Remaining reflecting two partial payments — the brief\'s worked example', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    const paymentRepo = new InMemoryPaymentRepository();
    await paymentRepo.create({
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
    await paymentRepo.create({
      invoiceId: created.id,
      invoiceNumber: 'INV-1',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 200,
      paymentDate: '2026-06-10',
      method: 'card',
      reference: null,
      notes: null,
    });
    mockInvoiceStore = createInvoiceStore(
      invoices,
      new InMemoryBusinessRepository(),
      new PaymentBackedPaymentTotalsRepository(paymentRepo),
    );
    mockPaymentStore = createPaymentStore(paymentRepo);

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('invoice-detail-payment-summary')).toBeTruthy());
    expect(view.getByTestId('payment-summary-total')).toHaveTextContent(/1000\.00/);
    expect(view.getByTestId('payment-summary-paid')).toHaveTextContent(/500\.00/);
    expect(view.getByTestId('payment-summary-remaining')).toHaveTextContent(/500\.00/);
    expect(view.getByTestId('invoice-detail-status')).toHaveTextContent(/Partial/);
    expect(view.queryByTestId('invoice-detail-no-payments')).toBeNull();
  });

  it('shows an Overpaid line instead of a negative Remaining when payments exceed the total', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create(
      'INV-1',
      makeInput({ items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 1, unitPrice: 500 }] }),
    );
    const paymentRepo = new InMemoryPaymentRepository();
    await paymentRepo.create({
      invoiceId: created.id,
      invoiceNumber: 'INV-1',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 800,
      paymentDate: '2026-06-05',
      method: 'cash',
      reference: null,
      notes: null,
    });
    mockInvoiceStore = createInvoiceStore(
      invoices,
      new InMemoryBusinessRepository(),
      new PaymentBackedPaymentTotalsRepository(paymentRepo),
    );
    mockPaymentStore = createPaymentStore(paymentRepo);

    const view = await renderScreen(created.id);

    await waitFor(() => expect(view.getByTestId('payment-summary-overpaid')).toBeTruthy());
    expect(view.getByTestId('payment-summary-overpaid')).toHaveTextContent(/300\.00/);
    expect(view.queryByTestId('payment-summary-remaining')).toBeNull();
    expect(view.getByTestId('invoice-detail-status')).toHaveTextContent(/Paid/);
  });

  it('tapping a payment row navigates to Edit Payment', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    const paymentRepo = new InMemoryPaymentRepository();
    const payment = await paymentRepo.create({
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
    mockInvoiceStore = createInvoiceStore(
      invoices,
      new InMemoryBusinessRepository(),
      new PaymentBackedPaymentTotalsRepository(paymentRepo),
    );
    mockPaymentStore = createPaymentStore(paymentRepo);

    const view = await renderScreen(created.id);

    await waitFor(() =>
      expect(view.getByTestId(`invoice-detail-payment-${payment.id}`)).toBeTruthy(),
    );
    fireEvent.press(view.getByTestId(`invoice-detail-payment-${payment.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('EditPayment', { paymentId: payment.id });
  });
});
