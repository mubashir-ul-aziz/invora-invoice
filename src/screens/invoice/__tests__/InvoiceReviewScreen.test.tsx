import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import type { Customer } from '@/domain/customer/types';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';
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

function renderScreen() {
  return render(<InvoiceReviewScreen navigation={navigation as never} route={{} as never} />);
}

describe('InvoiceReviewScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    mockInvoiceStore = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    useInvoiceDraftStore.getState().reset();
  });

  it('shows the customer, invoice type, items and computed totals for a create-mode draft', async () => {
    const businessRepo = new InMemoryBusinessRepository();
    await businessRepo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, invoicePrefix: 'ACM-', nextInvoiceNumber: 3 });
    mockBusinessProfileStore = createBusinessProfileStore(businessRepo);

    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 25 });

    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    expect(view.getByText('General')).toBeTruthy();
    expect(view.getByText('Widget')).toBeTruthy();
    await waitFor(() => expect(view.getByText('ACM-3')).toBeTruthy());
  });

  it('"Edit items" navigates back to the items step', async () => {
    mockBusinessProfileStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-edit-items')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-edit-items'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateInvoiceItems');
  });
});
