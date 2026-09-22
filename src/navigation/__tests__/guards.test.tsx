import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, lapsedInfo, makeHarness, type Harness } from '@/data/subscription/testFixtures';
import type { Invoice } from '@/domain/invoice/types';
import { createCustomerStore } from '@/state/customerStore';
import { createInvoiceStore } from '@/state/invoiceStore';
import { createPaymentStore } from '@/state/paymentStore';
import { createSubscriptionStore } from '@/state/subscriptionStore';

let mockSubscriptionStore: ReturnType<typeof createSubscriptionStore>;
let mockInvoiceStore: ReturnType<typeof createInvoiceStore>;
let mockCustomerStore: ReturnType<typeof createCustomerStore>;
let mockPaymentStore: ReturnType<typeof createPaymentStore>;

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@/state/subscriptionStore', () => ({
  ...jest.requireActual('@/state/subscriptionStore'),
  useSubscriptionStore: (...args: unknown[]) => (mockSubscriptionStore as any)(...args),
}));
jest.mock('@/state/invoiceStore', () => ({
  ...jest.requireActual('@/state/invoiceStore'),
  useInvoiceStore: (...args: unknown[]) => (mockInvoiceStore as any)(...args),
}));
jest.mock('@/state/customerStore', () => ({
  ...jest.requireActual('@/state/customerStore'),
  useCustomerStore: (...args: unknown[]) => (mockCustomerStore as any)(...args),
}));
jest.mock('@/state/paymentStore', () => ({
  ...jest.requireActual('@/state/paymentStore'),
  usePaymentStore: Object.assign((...args: unknown[]) => (mockPaymentStore as any)(...args), {
    getState: () => mockPaymentStore.getState(),
  }),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { byInvoiceId, byPaymentId, withCustomerHistoryGuard, withInvoiceAccessGuard } from '../guards';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Nav = {
  navigate: (screen: 'Pricing', params: { reason: 'locked_invoice' | 'locked_customer' }) => void;
  goBack: () => void;
};
type InvoiceScreenProps = { navigation: Nav; route: { params: { invoiceId: string } } };
type PaymentScreenProps = { navigation: Nav; route: { params: { paymentId: string } } };
type CustomerScreenProps = { navigation: Nav; route: { params: { customerId: string } } };

function Inner(_props: unknown) {
  return <Text testID="inner-screen">the real screen</Text>;
}

function invoiceCreatedAt(id: string, createdAtMs: number): Invoice {
  const iso = new Date(createdAtMs).toISOString();
  return {
    id,
    invoiceNumber: `INV-${id}`,
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: iso.slice(0, 10),
    dueDate: null,
    notes: null,
    terms: null,
    items: [],
    createdAt: iso,
    updatedAt: iso,
  };
}

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
let h: Harness;

async function boot(options: { plan?: Parameters<typeof activeInfo>[0]; init?: boolean; invoices?: Invoice[] } = {}) {
  h = makeHarness(Date.now());
  const invoices = new InMemoryInvoiceRepository(options.invoices ?? []);
  const entitlement = new EntitlementService(
    h.service,
    new InvoiceUsageTracker(invoices, h.cache, () => h.clock.now),
    () => h.clock.now,
  );
  mockSubscriptionStore = createSubscriptionStore(
    () => h.service,
    () => entitlement,
    jest.fn(),
  );
  mockInvoiceStore = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
  mockCustomerStore = createCustomerStore(
    new InMemoryCustomerRepository([
      {
        id: 'cust_1',
        name: 'Acme Co',
        phone: null,
        email: null,
        website: null,
        address: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]),
  );
  if (options.plan) {
    h.adapter.setCustomerInfo(activeInfo(options.plan, h.clock.now));
  }
  if (options.init !== false) {
    await mockSubscriptionStore.getState().init();
  }
}

describe('withInvoiceAccessGuard', () => {
  const Guarded = withInvoiceAccessGuard(Inner as React.ComponentType<InvoiceScreenProps>, byInvoiceId);
  const renderGuarded = (invoiceId: string) =>
    render(<Guarded navigation={navigation as never} route={{ params: { invoiceId } } as never} />);

  beforeEach(() => {
    navigation.navigate.mockClear();
    navigation.goBack.mockClear();
  });

  it('shows a Free user the upgrade screen for an invoice past its 24 hours — without deleting it', async () => {
    const old = invoiceCreatedAt('old', Date.now() - 3 * DAY);
    await boot({ invoices: [old] });
    const view = await renderGuarded('old');

    await waitFor(() => expect(view.getByTestId('locked-invoice')).toBeTruthy());
    expect(view.queryByTestId('inner-screen')).toBeNull();
    expect(view.getByText('Historical invoices are locked')).toBeTruthy();
    expect(view.getByText('Invoice INV-old')).toBeTruthy();
    expect(await mockInvoiceStore.getState().getById('old')).not.toBeNull();
  });

  it('shows only identifying details on the lock screen, never money or line items', async () => {
    await boot({ invoices: [invoiceCreatedAt('old', Date.now() - 3 * DAY)] });
    const view = await renderGuarded('old');
    await waitFor(() => expect(view.getByTestId('locked-invoice')).toBeTruthy());
    expect(view.queryByText(/Acme/)).toBeNull();
    expect(view.queryByText(/\$/)).toBeNull();
  });

  it('lets a Free user open an invoice created within the last 24 hours', async () => {
    await boot({ invoices: [invoiceCreatedAt('fresh', Date.now() - 2 * HOUR)] });
    const view = await renderGuarded('fresh');
    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());
    expect(view.queryByTestId('locked-invoice')).toBeNull();
  });

  it('locks exactly at the 24 hour mark', async () => {
    await boot({ invoices: [invoiceCreatedAt('edge', Date.now() - 24 * HOUR - 1000)] });
    const view = await renderGuarded('edge');
    await waitFor(() => expect(view.getByTestId('locked-invoice')).toBeTruthy());
  });

  it('lets paid users open any historical invoice', async () => {
    await boot({ plan: 'starter', invoices: [invoiceCreatedAt('old', Date.now() - 400 * DAY)] });
    const view = await renderGuarded('old');
    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());
  });

  it('sends the user to Pricing, or back, from the lock screen', async () => {
    await boot({ invoices: [invoiceCreatedAt('old', Date.now() - 3 * DAY)] });
    const view = await renderGuarded('old');
    await waitFor(() => expect(view.getByTestId('locked-view-plans')).toBeTruthy());

    await fireEvent.press(view.getByTestId('locked-view-plans'));
    expect(navigation.navigate).toHaveBeenCalledWith('Pricing', { reason: 'locked_invoice' });

    await fireEvent.press(view.getByTestId('locked-go-back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('unlocks in place the moment the user subscribes (historical access restored)', async () => {
    await boot({ invoices: [invoiceCreatedAt('old', Date.now() - 3 * DAY)] });
    const view = await renderGuarded('old');
    await waitFor(() => expect(view.getByTestId('locked-invoice')).toBeTruthy());

    await act(async () => {
      h.adapter.emit(activeInfo('business', h.clock.now));
    });

    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());
    expect(view.queryByTestId('locked-invoice')).toBeNull();
  });

  it('locks again if the subscription lapses, and never touches the invoice', async () => {
    await boot({ plan: 'pro', invoices: [invoiceCreatedAt('old', Date.now() - 3 * DAY)] });
    const view = await renderGuarded('old');
    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());

    await act(async () => {
      h.adapter.emit(lapsedInfo('pro', h.clock.now));
    });

    await waitFor(() => expect(view.getByTestId('locked-invoice')).toBeTruthy());
    expect(await mockInvoiceStore.getState().getById('old')).not.toBeNull();
  });

  it('does not flash a lock while the cached plan is still loading', async () => {
    await boot({ init: false, invoices: [invoiceCreatedAt('old', Date.now() - 3 * DAY)] });
    const view = await renderGuarded('old');

    await waitFor(() => expect(view.getByTestId('access-guard-loading')).toBeTruthy());
    expect(view.queryByTestId('locked-invoice')).toBeNull();
    expect(view.queryByTestId('inner-screen')).toBeNull();
  });

  it('renders the wrapped screen (so it shows its own "not found") when the invoice does not exist', async () => {
    await boot();
    const view = await renderGuarded('missing');
    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());
  });

  it('guards payment screens by the payment\'s invoice', async () => {
    const old = invoiceCreatedAt('old', Date.now() - 3 * DAY);
    const fresh = invoiceCreatedAt('fresh', Date.now() - HOUR);
    await boot({ invoices: [old, fresh] });
    const payments = new InMemoryPaymentRepository();
    const onOld = await payments.create({
      invoiceId: 'old',
      invoiceNumber: 'INV-old',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 10,
      paymentDate: '2026-09-01',
      method: 'cash',
      reference: null,
      notes: null,
    });
    const onFresh = await payments.create({
      invoiceId: 'fresh',
      invoiceNumber: 'INV-fresh',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 10,
      paymentDate: '2026-09-01',
      method: 'cash',
      reference: null,
      notes: null,
    });
    mockPaymentStore = createPaymentStore(payments);
    const GuardedPayment = withInvoiceAccessGuard(Inner as React.ComponentType<PaymentScreenProps>, byPaymentId);

    const locked = await render(<GuardedPayment navigation={navigation as never} route={{ params: { paymentId: onOld.id } } as never} />);
    await waitFor(() => expect(locked.getByTestId('locked-invoice')).toBeTruthy());
    await locked.unmount();

    const open = await render(<GuardedPayment navigation={navigation as never} route={{ params: { paymentId: onFresh.id } } as never} />);
    await waitFor(() => expect(open.getByTestId('inner-screen')).toBeTruthy());
  });
});

describe('withCustomerHistoryGuard', () => {
  const Guarded = withCustomerHistoryGuard(Inner as React.ComponentType<CustomerScreenProps>);
  const renderGuarded = () =>
    render(<Guarded navigation={navigation as never} route={{ params: { customerId: 'cust_1' } } as never} />);

  beforeEach(() => {
    navigation.navigate.mockClear();
    navigation.goBack.mockClear();
  });

  it('locks Customer History on Free but still names the customer', async () => {
    await boot();
    const view = await renderGuarded();

    await waitFor(() => expect(view.getByTestId('locked-customer-history')).toBeTruthy());
    expect(view.getByText('Customer history is locked')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    expect(view.queryByTestId('inner-screen')).toBeNull();

    await fireEvent.press(view.getByTestId('locked-view-plans'));
    expect(navigation.navigate).toHaveBeenCalledWith('Pricing', { reason: 'locked_customer' });
  });

  it('opens Customer History on any paid plan', async () => {
    await boot({ plan: 'starter' });
    const view = await renderGuarded();
    await waitFor(() => expect(view.getByTestId('inner-screen')).toBeTruthy());
  });

  it('does not flash a lock before the plan has loaded', async () => {
    await boot({ init: false });
    const view = await renderGuarded();
    await waitFor(() => expect(view.getByTestId('access-guard-loading')).toBeTruthy());
    expect(view.queryByTestId('locked-customer-history')).toBeNull();
  });
});
