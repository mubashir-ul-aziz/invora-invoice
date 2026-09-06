import { Alert } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createCustomerStore } from '@/state/customerStore';
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
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', unitPrice: 50 }],
    ...overrides,
  };
}

describe('InvoiceDetailScreen delete', () => {
  it('deletes the invoice after confirming and goes back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    mockCustomerStore = createCustomerStore(new InMemoryCustomerRepository());
    const invoices = new InMemoryInvoiceRepository();
    const created = await invoices.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    const view = await render(
      <InvoiceDetailScreen navigation={navigation as never} route={{ params: { invoiceId: created.id } } as never} />,
    );

    await waitFor(() => expect(view.getByTestId('action-delete-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-delete-invoice'));

    await waitFor(async () => expect(await invoices.getById(created.id)).toBeNull());
    expect(navigation.goBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
