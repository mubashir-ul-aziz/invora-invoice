import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, makeHarness, type Harness } from '@/data/subscription/testFixtures';
import type { Invoice } from '@/domain/invoice/types';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { createSubscriptionStore } from '@/state/subscriptionStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';

let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;
let mockInvoiceSettingsStore: ReturnType<typeof createInvoiceSettingsStore>;
let mockSubscriptionStore: ReturnType<typeof createSubscriptionStore>;

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@/state/invoiceStore', () => ({
  ...jest.requireActual('@/state/invoiceStore'),
  useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
}));
jest.mock('@/state/invoiceTypeStore', () => ({
  ...jest.requireActual('@/state/invoiceTypeStore'),
  useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
}));
jest.mock('@/state/invoiceSettingsStore', () => ({
  ...jest.requireActual('@/state/invoiceSettingsStore'),
  useInvoiceSettingsStore: (...args: unknown[]) => (mockInvoiceSettingsStore as any)(...args),
}));
jest.mock('@/state/subscriptionStore', () => ({
  ...jest.requireActual('@/state/subscriptionStore'),
  useSubscriptionStore: (...args: unknown[]) => (mockSubscriptionStore as any)(...args),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { InvoiceListScreen } from '../InvoiceListScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };
const HOUR = 3_600_000;

function invoice(id: string, createdAtMs: number): Invoice {
  const iso = new Date(createdAtMs).toISOString();
  return {
    id,
    invoiceNumber: `INV-${id}`,
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: iso.slice(0, 10),
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [],
    createdAt: iso,
    updatedAt: iso,
  };
}

let h: Harness;

async function boot(options: { plan?: Parameters<typeof activeInfo>[0]; invoices: Invoice[] }) {
  h = makeHarness(Date.now());
  const invoices = new InMemoryInvoiceRepository(options.invoices);
  const entitlement = new EntitlementService(
    h.service,
    new InvoiceUsageTracker(invoices, h.cache, () => h.clock.now),
    () => h.clock.now,
  );
  mockSubscriptionStore = createSubscriptionStore(() => h.service, () => entitlement, jest.fn());
  mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
  mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
  mockInvoiceSettingsStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
  if (options.plan) {
    h.adapter.setCustomerInfo(activeInfo(options.plan, h.clock.now));
  }
  await mockSubscriptionStore.getState().init();
}

const renderScreen = () => render(<InvoiceListScreen navigation={navigation as never} route={{} as never} />);

describe('InvoiceListScreen — subscription behaviour', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
    useInvoiceDraftStore.getState().reset();
  });

  it('marks invoices past the Free 24-hour window as locked, and only those', async () => {
    await boot({ invoices: [invoice('old', Date.now() - 48 * HOUR), invoice('new', Date.now() - HOUR)] });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-row-old')).toBeTruthy());
    expect(view.getByTestId('invoice-row-old-locked')).toBeTruthy();
    expect(view.queryByTestId('invoice-row-new-locked')).toBeNull();
  });

  it('keeps locked invoices in the list (nothing is hidden or deleted) and still routes taps to the invoice', async () => {
    await boot({ invoices: [invoice('old', Date.now() - 48 * HOUR)] });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('invoice-row-old')).toBeTruthy());

    await fireEvent.press(view.getByTestId('invoice-row-old'));

    // The InvoiceDetail route is guarded, so it shows the upgrade screen.
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: 'old' });
  });

  it('shows no locks at all on a paid plan', async () => {
    await boot({ plan: 'starter', invoices: [invoice('old', Date.now() - 400 * 24 * HOUR)] });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('invoice-row-old')).toBeTruthy());
    expect(view.queryByTestId('invoice-row-old-locked')).toBeNull();
  });

  it('starts a new invoice normally while under the monthly limit', async () => {
    await boot({ invoices: [] });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('action-create-invoice')).toBeTruthy());

    await fireEvent.press(view.getByTestId('action-create-invoice'));

    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList', expect.any(Object));
    expect(navigation.navigate).not.toHaveBeenCalledWith('Pricing', expect.anything());
  });

  it('shows the InvoiceLimitModal instead of starting an invoice once the monthly limit is used up, and its CTA goes to Pricing', async () => {
    const recent = Array.from({ length: 5 }, (_, i) => invoice(`r${i}`, Date.now() - (i + 1) * 10 * 60_000));
    await boot({ invoices: recent });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('action-create-invoice')).toBeTruthy());
    await waitFor(() => expect(mockSubscriptionStore.getState().usage?.used).toBe(5));

    await fireEvent.press(view.getByTestId('action-create-invoice'));

    expect(navigation.navigate).not.toHaveBeenCalledWith('Pricing', expect.anything());
    expect(navigation.navigate).not.toHaveBeenCalledWith('CustomerList', expect.anything());
    expect(useInvoiceDraftStore.getState().mode).toBeNull(); // no half-started draft
    await waitFor(() => expect(view.getByTestId('invoice-limit-modal-upgrade')).toBeTruthy());

    await fireEvent.press(view.getByTestId('invoice-limit-modal-upgrade'));

    expect(navigation.navigate).toHaveBeenCalledWith('Pricing', { reason: 'invoice_limit' });
  });
});
