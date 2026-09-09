import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCustomerStore } from '@/state/customerStore';
import { createCustomerActivityStore } from '@/state/customerActivityStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';

let mockCustomerStore: ReturnType<typeof createCustomerStore>;
let mockActivityStore: ReturnType<typeof createCustomerActivityStore>;
let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;

jest.mock('@/state/customerStore', () => {
  const actual = jest.requireActual('@/state/customerStore');
  return {
    ...actual,
    useCustomerStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCustomerStore as any)(...args),
  };
});

jest.mock('@/state/customerActivityStore', () => {
  const actual = jest.requireActual('@/state/customerActivityStore');
  return {
    ...actual,
    useCustomerActivityStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockActivityStore as any)(...args),
  };
});

jest.mock('@/state/invoiceStore', () => {
  const actual = jest.requireActual('@/state/invoiceStore');
  return {
    ...actual,
    useInvoiceStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockInvoiceStore as any)(...args),
  };
});

import { CustomerDetailScreen } from '../CustomerDetailScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function makeInvoiceInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
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

/** One render per file — see the note in `CustomerDetailScreen.test.tsx`. */
describe('CustomerDetailScreen invoices', () => {
  it('lists the customer\'s invoices and opens Invoice Detail on tap', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );

    const customerRepo = new InMemoryCustomerRepository();
    const created = await customerRepo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockCustomerStore = createCustomerStore(customerRepo);

    const otherInvoice = await mockInvoiceStore
      .getState()
      .create(makeInvoiceInput({ customerId: 'someone-else', customerName: 'Other Co' }));
    const ownInvoice = await mockInvoiceStore.getState().create(makeInvoiceInput({ customerId: created.id }));

    const view = await render(
      <CustomerDetailScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() =>
      expect(view.getByTestId(`customer-invoice-row-${ownInvoice.id}`)).toBeTruthy(),
    );
    expect(view.queryByTestId(`customer-invoice-row-${otherInvoice.id}`)).toBeNull();

    fireEvent.press(view.getByTestId(`customer-invoice-row-${ownInvoice.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: ownInvoice.id });
  });

  it('shows an empty state when the customer has no invoices', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );

    const customerRepo = new InMemoryCustomerRepository();
    const created = await customerRepo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockCustomerStore = createCustomerStore(customerRepo);

    const view = await render(
      <CustomerDetailScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('customer-detail-invoices')).toBeTruthy());
    expect(view.getByText('No invoices yet.')).toBeTruthy();
  });
});
