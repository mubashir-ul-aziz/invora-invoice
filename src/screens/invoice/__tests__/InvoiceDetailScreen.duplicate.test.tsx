import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createCustomerStore } from '@/state/customerStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
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
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

describe('InvoiceDetailScreen duplicate', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    useInvoiceDraftStore.getState().reset();
    mockPaymentStore = createPaymentStore(new InMemoryPaymentRepository());
  });

  it('seeds the draft from the invoice and its real customer, then opens Review', async () => {
    const customers = new InMemoryCustomerRepository();
    const customer = await customers.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co', email: 'a@acme.com' });
    mockCustomerStore = createCustomerStore(customers);

    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput({ customerId: customer.id }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await render(
      <InvoiceDetailScreen navigation={navigation as never} route={{ params: { invoiceId: created.id } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('invoice-detail-menu')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-detail-menu'));
    await waitFor(() => expect(view.getByTestId('action-duplicate-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-duplicate-invoice'));

    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('InvoiceReview'));
    const draft = useInvoiceDraftStore.getState();
    expect(draft.mode).toBe('duplicate');
    expect(draft.editingInvoiceId).toBeNull();
    expect(draft.customer?.email).toBe('a@acme.com');
    expect(draft.items).toHaveLength(1);
    expect(draft.dueDate).toBeNull();
  });

  it('falls back to the invoice’s name snapshot if the customer contact is gone', async () => {
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository()); // empty — customer not found

    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput({ customerId: 'deleted_customer' }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await render(
      <InvoiceDetailScreen navigation={navigation as never} route={{ params: { invoiceId: created.id } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('invoice-detail-menu')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-detail-menu'));
    await waitFor(() => expect(view.getByTestId('action-duplicate-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-duplicate-invoice'));

    await waitFor(() => expect(useInvoiceDraftStore.getState().customer?.name).toBe('Acme Co'));
  });
});
