import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 1, unitPrice: 500 }],
    ...overrides,
  };
}

/** One resolver-triggered submission per file — see the note in `RecordPaymentScreen.save.test.tsx`. */
describe('RecordPaymentScreen overpayment', () => {
  it('allows recording a payment larger than the remaining balance', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput()); // grand total 500
    const payments = new InMemoryPaymentRepository();
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    mockPaymentStore = createPaymentStore(payments);

    const view = await render(
      <RecordPaymentScreen navigation={navigation as never} route={{ params: { invoiceId: created.id } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('field-amount')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-amount'), '800');
    fireEvent.changeText(view.getByTestId('field-paymentDate'), '2026-06-05');
    fireEvent.press(view.getByTestId('save-payment'));

    await waitFor(async () => expect(await payments.listByInvoice(created.id)).toHaveLength(1));
    const [recorded] = await payments.listByInvoice(created.id);
    expect(recorded.amount).toBe(800);
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: created.id });
  });
});
