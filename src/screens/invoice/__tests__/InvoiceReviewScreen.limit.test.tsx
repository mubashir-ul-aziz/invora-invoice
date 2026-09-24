import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import type { Customer } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT } from '@/domain/invoice/types';
import { InvoiceLimitError, computeInvoiceUsage, getUsagePeriod } from '@/domain/subscription/invoiceAccess';
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

/** One submitting test per file — see the codebase-wide note on react-hook-form's async resolver. */
describe('InvoiceReviewScreen save at the monthly invoice limit', () => {
  it('saves nothing, keeps the draft, shows the InvoiceLimitModal, and its CTA sends the user to Pricing', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const businessRepo = new InMemoryBusinessRepository();
    mockBusinessProfileStore = createBusinessProfileStore(businessRepo);
    const invoiceRepo = new InMemoryInvoiceRepository();
    const usage = computeInvoiceUsage('free', 5, getUsagePeriod(Date.now()));
    mockInvoiceStore = createInvoiceStore(invoiceRepo, businessRepo, new ZeroPaymentTotalsRepository(), {
      assertCanCreate: () => Promise.reject(new InvoiceLimitError(usage)),
      recordCreated: jest.fn(),
    });

    useInvoiceDraftStore.getState().reset();
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    useInvoiceDraftStore
      .getState()
      .addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 25 });

    const view = await render(<InvoiceReviewScreen navigation={navigation as never} route={{} as never} />);

    await waitFor(() => expect(view.getByTestId('save-invoice')).toBeTruthy());
    await fireEvent.press(view.getByTestId('save-invoice'));

    // Nothing saved, draft kept for after the upgrade, and no "couldn't save" alert shown — the
    // limit is presented via the InvoiceLimitModal, not a native Alert.
    await waitFor(() => expect(view.getByTestId('invoice-limit-modal-upgrade')).toBeTruthy());
    expect(view.getByText('5 / 5')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(await invoiceRepo.list()).toHaveLength(0);
    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(useInvoiceDraftStore.getState().items).toHaveLength(1);

    await fireEvent.press(view.getByTestId('invoice-limit-modal-upgrade'));

    expect(navigation.navigate).toHaveBeenCalledWith('Pricing', { reason: 'invoice_limit' });
  });
});
