import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, makeHarness, type Harness } from '@/data/subscription/testFixtures';
import { createSubscriptionStore } from '@/state/subscriptionStore';

let mockStore: ReturnType<typeof createSubscriptionStore>;

jest.mock('@/state/subscriptionStore', () => {
  const actual = jest.requireActual('@/state/subscriptionStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSubscriptionStore: (...args: unknown[]) => (mockStore as any)(...args),
  };
});

import { PricingScreen } from '../PricingScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

let h: Harness;
let openUrl: jest.Mock;

async function renderScreen(params?: Record<string, unknown>) {
  const view = render(<PricingScreen navigation={navigation as never} route={{ params } as never} />);
  // Let the mount effects (refresh, offerings, usage) settle.
  await waitFor(() => expect(mockStore.getState().offeringsStatus).not.toBe('loading'));
  return view;
}

async function boot(plan?: Parameters<typeof activeInfo>[0], options: Parameters<typeof activeInfo>[2] = {}) {
  h = makeHarness();
  const tracker = new InvoiceUsageTracker(new InMemoryInvoiceRepository(), h.cache, () => h.clock.now);
  const entitlement = new EntitlementService(h.service, tracker, () => h.clock.now);
  openUrl = jest.fn().mockResolvedValue(true);
  mockStore = createSubscriptionStore(
    () => h.service,
    () => entitlement,
    openUrl,
  );
  if (plan) {
    h.adapter.setCustomerInfo(activeInfo(plan, h.clock.now, options));
  }
  await mockStore.getState().init();
}

describe('PricingScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    navigation.navigate.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists Free, Starter, Business, Pro and Unlimited, with MOST POPULAR on Business only', async () => {
    await boot();
    const view = await renderScreen();

    for (const id of ['free', 'starter', 'business', 'pro', 'unlimited']) {
      expect(view.getByTestId(`plan-${id}`)).toBeTruthy();
    }
    expect(view.getByTestId('plan-business-badge')).toBeTruthy();
    expect(within(view.getByTestId('plan-business-badge')).getByText('MOST POPULAR')).toBeTruthy();
    expect(view.queryByTestId('plan-starter-badge')).toBeNull();
    expect(view.queryByTestId('plan-pro-badge')).toBeNull();
    expect(view.queryByTestId('plan-unlimited-badge')).toBeNull();
  });

  it('shows invoice limits per plan from the config', async () => {
    await boot();
    const view = await renderScreen();

    expect(within(view.getByTestId('plan-free')).getByText('5 invoices / month')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText('15 invoices / month')).toBeTruthy();
    expect(within(view.getByTestId('plan-business')).getByText('40 invoices / month')).toBeTruthy();
    expect(within(view.getByTestId('plan-pro')).getByText('100 invoices / month')).toBeTruthy();
    expect(within(view.getByTestId('plan-unlimited')).getByText('Unlimited invoices')).toBeTruthy();
    expect(within(view.getByTestId('plan-free')).getByText('Recent invoices only (24 hours)')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText('Historical invoices')).toBeTruthy();
  });

  it('shows the current plan, status and usage', async () => {
    await boot();
    const view = await renderScreen();

    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Free');
    expect(view.getByTestId('plan-free-current')).toBeTruthy();
    await waitFor(() => expect(view.getByText('0 of 5 invoices used this month')).toBeTruthy());
  });

  it('shows monthly prices from the store offering, then yearly with real savings', async () => {
    await boot();
    const view = await renderScreen();

    expect(within(view.getByTestId('plan-starter')).getByText('$5.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-business')).getByText('$10.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-pro')).getByText('$15.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-unlimited')).getByText('$20.00')).toBeTruthy();

    await fireEvent.press(view.getByTestId('billing-toggle-yearly'));

    expect(within(view.getByTestId('plan-starter')).getByText('$48.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-business')).getByText('$96.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-pro')).getByText('$144.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-unlimited')).getByText('$192.00')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText('Save 20% vs paying monthly')).toBeTruthy();
  });

  it('shows no savings claim when the real prices do not support one', async () => {
    await boot();
    h.adapter.packages = h.adapter.packages.map((pkg) =>
      pkg.period === 'yearly' ? { ...pkg, priceMicros: pkg.priceMicros / 48 * 60 } : pkg,
    );
    const view = await renderScreen();
    await fireEvent.press(view.getByTestId('billing-toggle-yearly'));

    expect(view.queryByText(/Save \d+%/)).toBeNull();
  });

  it('buys the selected plan and period, and reports success only once RevenueCat confirms it', async () => {
    await boot();
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now);
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('plan-business-cta'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Business is active', expect.stringContaining('confirmed')));
    expect(h.adapter.calls.purchase[0].packageId).toBe('business_monthly');
    await waitFor(() => expect(view.getByTestId('pricing-current-plan').props.children).toBe('Business'));
  });

  it('buys the yearly package when Yearly is selected', async () => {
    await boot();
    h.adapter.onPurchase = () => activeInfo('starter', h.clock.now, { period: 'yearly' });
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('billing-toggle-yearly'));
    await fireEvent.press(view.getByTestId('plan-starter-cta'));

    await waitFor(() => expect(h.adapter.calls.purchase[0]?.packageId).toBe('starter_yearly'));
  });

  it('never says a payment succeeded when the purchase is only pending', async () => {
    await boot();
    const view = await renderScreen();
    h.adapter.failNext('pending'); // after mount, so the mount-time refresh doesn't consume it

    await fireEvent.press(view.getByTestId('plan-pro-cta'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Waiting for Google Play', expect.stringContaining('not unlocked')));
    const titles = (Alert.alert as jest.Mock).mock.calls.map((call) => call[0]);
    expect(titles.some((title: string) => /active|success/i.test(title))).toBe(false);
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Free');
    expect(view.getByText('Payment pending')).toBeTruthy();
  });

  it('says nothing when the user cancels the Google Play sheet', async () => {
    await boot();
    const view = await renderScreen();
    h.adapter.failNext('cancelled'); // after mount, so the mount-time refresh doesn't consume it

    await fireEvent.press(view.getByTestId('plan-starter-cta'));

    await waitFor(() => expect(h.adapter.calls.purchase).toHaveLength(1));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Free');
  });

  it('explains store and network failures', async () => {
    await boot();
    const view = await renderScreen();

    h.adapter.failNext('store_unavailable');
    await fireEvent.press(view.getByTestId('plan-starter-cta'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Google Play unavailable', expect.any(String)));

    h.connectivity.setOnline(false);
    await fireEvent.press(view.getByTestId('plan-starter-cta'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('No connection', expect.stringContaining('not been charged')));
  });

  it('marks the current paid plan and disables its button', async () => {
    await boot('business');
    const view = await renderScreen();

    expect(view.getByTestId('plan-business-current')).toBeTruthy();
    expect(view.getByTestId('plan-business-cta').props.accessibilityState.disabled).toBe(true);
    expect(within(view.getByTestId('plan-business-cta')).getByText('Current plan')).toBeTruthy();
    expect(view.getByText('Active')).toBeTruthy();
  });

  it('offers a higher plan as an upgrade and a lower one as a switch at renewal', async () => {
    await boot('business');
    const view = await renderScreen();

    expect(within(view.getByTestId('plan-unlimited')).getByText('Upgrade to Unlimited')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText('Switch to Starter')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText(/next renewal/)).toBeTruthy();
  });

  it('schedules a downgrade instead of claiming it happened', async () => {
    await boot('pro');
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('plan-starter-cta'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Plan change scheduled', expect.stringContaining('next renewal')));
    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_pro', timing: 'deferred' });
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Pro');
  });

  it('shows cancelled-but-active and billing-issue states', async () => {
    await boot('pro', { willRenew: false });
    let view = await renderScreen();
    expect(view.getByText('Cancelled — active until it ends')).toBeTruthy();
    expect(view.getByText(/it will not renew/)).toBeTruthy();
    await view.unmount();

    await boot('pro', { billingIssue: true });
    view = await renderScreen();
    expect(view.getByText('Billing issue')).toBeTruthy();
    expect(view.getByText(/Update your payment method/)).toBeTruthy();
  });

  it('keeps showing the saved plan, with an offline notice, when offline', async () => {
    await boot('business');
    h.connectivity.setOnline(false);
    await mockStore.getState().refresh('foreground');
    const view = await renderScreen();

    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Business');
    expect(view.getByTestId('pricing-offline')).toBeTruthy();
    expect(view.getByText('Offline — using saved plan')).toBeTruthy();
  });

  it('shows reference prices with purchasing disabled when plans cannot be loaded', async () => {
    await boot();
    h.adapter.failNext('network');
    const view = await renderScreen();

    expect(view.getByTestId('pricing-offerings-error')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText('$5')).toBeTruthy();
    expect(within(view.getByTestId('plan-starter')).getByText(/Reference price/)).toBeTruthy();
    expect(view.getByTestId('plan-starter-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('restores purchases and reports each outcome honestly', async () => {
    await boot();
    h.adapter.restoreResult = activeInfo('business', h.clock.now);
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('action-restore-purchases'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Purchases restored', expect.any(String)));
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Business');

    await fireEvent.press(view.getByTestId('action-restore-purchases'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Already active', expect.any(String)));
  });

  it('says so when there is nothing to restore', async () => {
    await boot();
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('action-restore-purchases'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Nothing to restore', expect.any(String)));
  });

  it('opens Google Play subscription management', async () => {
    await boot();
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('action-manage-subscription'));

    await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions'));
  });

  it('explains why the user was sent here', async () => {
    await boot();
    let view = await renderScreen({ reason: 'invoice_limit' });
    expect(within(view.getByTestId('pricing-reason')).getByText('Monthly invoice limit reached')).toBeTruthy();
    await view.unmount();

    view = await renderScreen({ reason: 'locked_invoice' });
    expect(within(view.getByTestId('pricing-reason')).getByText('Historical invoices are locked')).toBeTruthy();
    expect(within(view.getByTestId('pricing-reason')).getByText(/nothing has been deleted/)).toBeTruthy();
    await view.unmount();

    view = await renderScreen({ reason: 'locked_customer' });
    expect(within(view.getByTestId('pricing-reason')).getByText('Customer history is locked')).toBeTruthy();
  });

  it('reassures that data is never deleted by a plan change', async () => {
    await boot();
    const view = await renderScreen();
    expect(view.getByTestId('pricing-data-note').props.children).toMatch(/always stay saved on this device/);
  });
});
