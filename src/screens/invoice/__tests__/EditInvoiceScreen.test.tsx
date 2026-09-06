import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createCustomerStore } from '@/state/customerStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

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

import { EditInvoiceScreen } from '../EditInvoiceScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', unitPrice: 50 }],
    ...overrides,
  };
}

describe('EditInvoiceScreen', () => {
  beforeEach(() => {
    (navigation.replace as jest.Mock).mockClear();
    useInvoiceDraftStore.getState().reset();
  });

  it('loads the invoice and its customer, seeds the draft, and replaces into the items screen', async () => {
    const customers = new InMemoryCustomerRepository();
    const customer = await customers.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockCustomerStore = createCustomerStore(customers);

    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput({ customerId: customer.id }));
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    await render(
      <EditInvoiceScreen navigation={navigation as never} route={{ params: { invoiceId: created.id } } as never} />,
    );

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('CreateInvoiceItems'));
    const draft = useInvoiceDraftStore.getState();
    expect(draft.mode).toBe('edit');
    expect(draft.editingInvoiceId).toBe(created.id);
    expect(draft.customer?.id).toBe(customer.id);
  });

  it('shows a not-found state for a missing invoice', async () => {
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository());
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );

    const view = await render(
      <EditInvoiceScreen navigation={navigation as never} route={{ params: { invoiceId: 'missing' } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('edit-invoice-not-found')).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
