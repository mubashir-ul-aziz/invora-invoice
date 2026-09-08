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

import { EditPaymentScreen } from '../EditPaymentScreen';

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

describe('EditPaymentScreen save', () => {
  it('corrects a mistaken amount and saves, keeping the invoice fixed', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    const payments = new InMemoryPaymentRepository();
    const payment = await payments.create({
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

    const view = await render(
      <EditPaymentScreen navigation={navigation as never} route={{ params: { paymentId: payment.id } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('field-amount')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('field-amount'), '350');
    fireEvent.press(view.getByTestId('save-payment'));

    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: created.id });

    const updated = await payments.getById(payment.id);
    expect(updated?.amount).toBe(350);
    expect(updated?.invoiceId).toBe(created.id);
  });
});
