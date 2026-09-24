import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerActivityRepository } from '@/data/customerActivity/InMemoryCustomerActivityRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, makeHarness, type Harness } from '@/data/subscription/testFixtures';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';
import { createCustomerActivityStore } from '@/state/customerActivityStore';
import { createCustomerStore } from '@/state/customerStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createSubscriptionStore } from '@/state/subscriptionStore';

let mockCustomerStore: ReturnType<typeof createCustomerStore>;
let mockActivityStore: ReturnType<typeof createCustomerActivityStore>;
let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockSubscriptionStore: ReturnType<typeof createSubscriptionStore>;

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@/state/customerStore', () => ({
  ...jest.requireActual('@/state/customerStore'),
  useCustomerStore: (...args: unknown[]) => (mockCustomerStore as any)(...args),
}));
jest.mock('@/state/customerActivityStore', () => ({
  ...jest.requireActual('@/state/customerActivityStore'),
  useCustomerActivityStore: (...args: unknown[]) => (mockActivityStore as any)(...args),
}));
jest.mock('@/state/invoiceStore', () => ({
  ...jest.requireActual('@/state/invoiceStore'),
  useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
}));
jest.mock('@/state/subscriptionStore', () => ({
  ...jest.requireActual('@/state/subscriptionStore'),
  useSubscriptionStore: (...args: unknown[]) => (mockSubscriptionStore as any)(...args),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { CustomerDetailScreen } from '../CustomerDetailScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let h: Harness;

async function boot(plan?: 'starter') {
  h = makeHarness(Date.now());
  const entitlement = new EntitlementService(
    h.service,
    new InvoiceUsageTracker(new InMemoryInvoiceRepository(), h.cache, () => h.clock.now),
    () => h.clock.now,
  );
  mockSubscriptionStore = createSubscriptionStore(() => h.service, () => entitlement, jest.fn());
  if (plan) {
    h.adapter.setCustomerInfo(activeInfo(plan, h.clock.now));
  }
  await mockSubscriptionStore.getState().init();
}

async function renderScreen() {
  mockActivityStore = createCustomerActivityStore(new InMemoryCustomerActivityRepository());
  mockInvoiceStore = createInvoiceStore(
    new InMemoryInvoiceRepository(),
    new InMemoryBusinessRepository(),
    new ZeroPaymentTotalsRepository(),
  );
  const repo = new InMemoryCustomerRepository();
  const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });
  mockCustomerStore = createCustomerStore(repo);
  return render(
    <CustomerDetailScreen navigation={navigation as never} route={{ params: { customerId: created.id } } as never} />,
  );
}

describe('CustomerDetailScreen — customer history lock', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
  });

  it('shows the CustomerLockedModal (not the History screen) for a Free user, naming the customer', async () => {
    await boot();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-view-history')).toBeTruthy());
    await fireEvent.press(view.getByTestId('action-view-history'));

    await waitFor(() => expect(view.getByTestId('customer-detail-history-locked-modal')).toBeTruthy());
    expect(navigation.navigate).not.toHaveBeenCalledWith('CustomerHistory', expect.anything());
    const modal = within(view.getByTestId('customer-detail-history-locked-modal'));
    expect(modal.getByText('Customer history is locked')).toBeTruthy();
    expect(modal.getByText('Acme Co')).toBeTruthy();
  });

  it('sends the user to Pricing from the modal, with the locked_customer reason', async () => {
    await boot();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('action-view-history')).toBeTruthy());
    await fireEvent.press(view.getByTestId('action-view-history'));
    await waitFor(() => expect(view.getByTestId('customer-locked-modal-upgrade')).toBeTruthy());

    await fireEvent.press(view.getByTestId('customer-locked-modal-upgrade'));

    expect(navigation.navigate).toHaveBeenCalledWith('Pricing', { reason: 'locked_customer' });
  });

  it('navigates straight into Customer History for a paid plan — no modal', async () => {
    await boot('starter');
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('action-view-history')).toBeTruthy());

    await fireEvent.press(view.getByTestId('action-view-history'));

    expect(navigation.navigate).toHaveBeenCalledWith('CustomerHistory', expect.any(Object));
    expect(view.queryByTestId('customer-detail-history-locked-modal')).toBeNull();
  });
});
