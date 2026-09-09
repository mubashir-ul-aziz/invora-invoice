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

/** One render per file — see the note in `CustomerDetailScreen.test.tsx`. */
describe('CustomerDetailScreen coming-soon actions', () => {
  it('Record Payment now navigates to the invoice picker (Phase 7) instead of alerting', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockCustomerStore = createCustomerStore(repo);
    navigation.navigate.mockClear();

    const view = await render(
      <CustomerDetailScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('action-record-payment')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-record-payment'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'InvoiceList',
      expect.objectContaining({ customerId: created.id, onSelectInvoice: expect.any(Function) }),
    );
  });

  it('Create Invoice now navigates for real (Phase 6) instead of alerting', async () => {
    mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
    mockCustomerStore = createCustomerStore(repo);
    navigation.navigate.mockClear();

    const view = await render(
      <CustomerDetailScreen
        navigation={navigation as never}
        route={{ params: { customerId: created.id } } as never}
      />,
    );

    await waitFor(() => expect(view.getByTestId('action-create-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-invoice'));

    expect(navigation.navigate).toHaveBeenCalledWith('CreateInvoiceItems');
  });
});
