import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import type { Customer } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
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
  website: null,
  address: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 1, unitPrice: 100 }],
    ...overrides,
  };
}

/** One submitting test per file — see the codebase-wide note on react-hook-form's async resolver. */
describe('InvoiceReviewScreen save (edit)', () => {
  it('updates the existing invoice in place, keeping its number', async () => {
    const businessRepo = new InMemoryBusinessRepository();
    mockBusinessProfileStore = createBusinessProfileStore(businessRepo);
    const invoiceRepo = new InMemoryInvoiceRepository();
    const existing = await invoiceRepo.create('INV-1', makeInput());
    mockInvoiceStore = createInvoiceStore(invoiceRepo, businessRepo, new ZeroPaymentTotalsRepository());

    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startEdit(existing, CUSTOMER);
    // Change the one existing line's quantity to exercise the update path.
    useInvoiceDraftStore.getState().updateLine(0, { ...useInvoiceDraftStore.getState().items[0], quantity: 3 });

    const view = await render(<InvoiceReviewScreen navigation={navigation as never} route={{} as never} />);

    await waitFor(() => expect(view.getByText('INV-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('save-invoice'));

    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: existing.id });

    const updated = await invoiceRepo.getById(existing.id);
    expect(updated?.invoiceNumber).toBe('INV-1');
    expect(updated?.items[0].quantity).toBe(3);
    expect(updated?.items[0].lineTotal).toBe(300);
  });
});
