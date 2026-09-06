import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import type { Customer } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT } from '@/domain/invoice/types';
import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockBusinessProfileStore: ReturnType<typeof createBusinessProfileStore>;

jest.mock('@/state/invoiceStore', () => {
  const actual = jest.requireActual('@/state/invoiceStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
  };
});

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useBusinessProfileStore: (...args: unknown[]) => (mockBusinessProfileStore as any)(...args),
  };
});

import { InvoiceReviewScreen } from '../InvoiceReviewScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn() };

const CUSTOMER: Customer = {
  id: 'cust_1',
  name: 'Acme Co',
  phone: null,
  email: null,
  address: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** One submitting test per file — see the codebase-wide note on react-hook-form's async resolver. */
describe('InvoiceReviewScreen save (create)', () => {
  it('creates the invoice, reserving a number, then navigates to Invoice Detail', async () => {
    const businessRepo = new InMemoryBusinessRepository();
    mockBusinessProfileStore = createBusinessProfileStore(businessRepo);
    const invoiceRepo = new InMemoryInvoiceRepository();
    mockInvoiceStore = createInvoiceStore(invoiceRepo, businessRepo, new ZeroPaymentTotalsRepository());

    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 25 });

    const view = await render(<InvoiceReviewScreen navigation={navigation as never} route={{} as never} />);

    await waitFor(() => expect(view.getByTestId('save-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('save-invoice'));

    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: expect.any(String) });

    const created = await invoiceRepo.list();
    expect(created).toHaveLength(1);
    expect(created[0].invoiceNumber).toBe('INV-1');
    expect(created[0].items[0].lineTotal).toBe(50);
  });
});
