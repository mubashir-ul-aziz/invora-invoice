import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { RevenueCatError } from '@/data/subscription/RevenueCatAdapter';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, DAY, makeHarness, START, type Harness } from '@/data/subscription/testFixtures';
import type { Invoice } from '@/domain/invoice/types';
import { OFFLINE_GRACE_MS } from '@/domain/subscription/offlinePolicy';
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

function seedInvoices(count: number): Invoice[] {
  const iso = new Date(START).toISOString();
  return Array.from({ length: count }, (_, i) => ({
    id: `inv_${i}`,
    invoiceNumber: `INV-${i}`,
    customerId: 'c',
    customerName: 'C',
    invoiceTypeId: 'general',
    issueDate: iso.slice(0, 10),
    dueDate: null,
    notes: null,
    terms: null,
    items: [],
    createdAt: iso,
    updatedAt: iso,
  }));
}

async function boot(
  plan?: Parameters<typeof activeInfo>[0],
  options: Parameters<typeof activeInfo>[2] = {},
  invoiceCount = 0,
) {
  h = makeHarness();
  const tracker = new InvoiceUsageTracker(new InMemoryInvoiceRepository(seedInvoices(invoiceCount)), h.cache, () => h.clock.now);
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
    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_pro_monthly', timing: 'deferred' });
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

  it('tells a paying user to reconnect once their subscription can no longer be verified (stale)', async () => {
    await boot('business');
    h.connectivity.setOnline(false);
    h.clock.now += OFFLINE_GRACE_MS + DAY; // past the offline policy's maximum trust window
    await mockStore.getState().refresh('foreground');
    const view = await renderScreen();

    // The effective plan already fell back to Free (see offlinePolicy.ts), but the last verified
    // subscription was Business — the banner should say so, not just "not verified yet".
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Free');
    expect(view.getByTestId('pricing-stale-trust')).toBeTruthy();
    expect(view.getByText(/Business plan for more than 3 days/)).toBeTruthy();
  });

  it('does not show the stale-trust banner for a Free user (nothing to verify)', async () => {
    await boot();
    h.connectivity.setOnline(false);
    h.clock.now += OFFLINE_GRACE_MS + DAY;
    await mockStore.getState().refresh('foreground');
    const view = await renderScreen();

    expect(view.queryByTestId('pricing-stale-trust')).toBeNull();
  });

  it('J/L. keeps plans, limits and standard prices when RevenueCat has no usable Offering; Retry loads store prices', async () => {
    await boot();
    const original = h.adapter.getOfferings.bind(h.adapter);
    let broken = true;
    h.adapter.getOfferings = async () => {
      if (broken) throw new RevenueCatError('configuration', 'No "metriqo_premium" Offering and no Current Offering is set in RevenueCat.');
      return original();
    };
    const view = await renderScreen();

    expect(view.getByTestId('pricing-offerings-error')).toBeTruthy();
    expect(view.getByText("Store plans couldn't be loaded")).toBeTruthy();
    expect(view.getByTestId('pricing-offerings-dev-detail').props.children.join('')).toMatch(/metriqo_premium/);
    expect(view.queryByText(/Price unavailable/)).toBeNull();
    expect(view.queryByText('—')).toBeNull();
    expect(view.getByTestId('plan-starter-price').props.children).toBe('$5');
    expect(view.getByTestId('plan-business-price').props.children).toBe('$10');
    expect(view.getByTestId('plan-pro-price').props.children).toBe('$15');
    expect(view.getByTestId('plan-unlimited-price').props.children).toBe('$20');
    expect(within(view.getByTestId('plan-starter')).getByText('15 invoices / month')).toBeTruthy();
    // Not silently disabled: tapping explains the problem.
    expect(view.getByTestId('plan-starter-cta').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(view.getByTestId('billing-toggle-yearly'));
    expect(view.getByTestId('plan-starter-price').props.children).toBe('$48');
    expect(view.getByTestId('plan-business-price').props.children).toBe('$96');
    expect(view.getByTestId('plan-pro-price').props.children).toBe('$144');
    expect(view.getByTestId('plan-unlimited-price').props.children).toBe('$192');

    broken = false;
    await fireEvent.press(view.getByTestId('pricing-retry-offerings'));
    await waitFor(() => expect(view.getByTestId('plan-starter-price').props.children).toBe('$48.00'));
    expect(view.queryByTestId('pricing-offerings-error')).toBeNull();
  });

  it('J. offline: shows standard prices and features with an offline notice', async () => {
    await boot();
    h.connectivity.setOnline(false);
    const view = await renderScreen();

    expect(view.getByText("You're offline")).toBeTruthy();
    expect(view.getByText(/Connect to the internet to upgrade/)).toBeTruthy();
    expect(view.getByTestId('plan-pro-price').props.children).toBe('$15');
    expect(within(view.getByTestId('plan-pro')).getByText('100 invoices / month')).toBeTruthy();
    expect(h.adapter.calls.getOfferings).toBe(0);
  });

  it('K. offline upgrade attempt: explains, never reaches the store, never fakes a purchase', async () => {
    await boot();
    h.connectivity.setOnline(false);
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('plan-starter-cta'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('No connection', expect.stringContaining('Connect to the internet to upgrade')));
    expect(h.adapter.calls.purchase).toHaveLength(0);
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Free');
  });

  it('L. a build without RevenueCat says so (with the dev reason) and Upgrade explains instead of doing nothing', async () => {
    await boot();
    h.adapter.available = false;
    const view = await renderScreen();

    expect(view.getByText("Purchases aren't available in this build")).toBeTruthy();
    expect(view.queryByTestId('pricing-retry-offerings')).toBeNull();
    expect(view.getByTestId('plan-business-price').props.children).toBe('$10');

    await fireEvent.press(view.getByTestId('plan-business-cta'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Purchases unavailable', expect.stringContaining('No RevenueCat key')));

    await fireEvent.press(view.getByTestId('action-restore-purchases'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Restore unavailable', expect.any(String)));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('C. Free at 5/5 buys Starter Monthly: the screen shows Starter and 5 of 15 immediately', async () => {
    await boot(undefined, {}, 5);
    h.adapter.onPurchase = () => activeInfo('starter', h.clock.now, { store: 'TEST_STORE' });
    const view = await renderScreen({ reason: 'invoice_limit' });
    await waitFor(() => expect(view.getByText('5 of 5 invoices used this month')).toBeTruthy());

    await fireEvent.press(view.getByTestId('plan-starter-cta'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Starter is active', expect.any(String)));
    expect(h.adapter.calls.purchase[0].packageId).toBe('starter_monthly');
    await waitFor(() => expect(view.getByText('5 of 15 invoices used this month')).toBeTruthy());
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Starter');
  });

  it('shows the standard price while the offering loads, then the store price', async () => {
    await boot();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = h.adapter.getOfferings.bind(h.adapter);
    h.adapter.getOfferings = async () => {
      await gate;
      return original();
    };
    const view = await render(<PricingScreen navigation={navigation as never} route={{ params: undefined } as never} />);
    await waitFor(() => expect(mockStore.getState().offeringsStatus).toBe('loading'));

    expect(view.getByTestId('plan-pro-price').props.children).toBe('$15');

    release();
    await waitFor(() => expect(view.getByTestId('plan-pro-price').props.children).toBe('$15.00'));
  });

  it("displays the store's localized price string exactly as RevenueCat returns it", async () => {
    await boot();
    h.adapter.packages = h.adapter.packages.map((pkg) =>
      pkg.packageId === 'business_monthly' ? { ...pkg, priceString: '9,99 €', currencyCode: 'EUR' } : pkg,
    );
    const view = await renderScreen();

    expect(view.getByTestId('plan-business-price').props.children).toBe('9,99 €');
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

  it('offers no Google Play link to a Free user (no empty Play Subscriptions page)', async () => {
    await boot();
    const view = await renderScreen();
    expect(view.queryByTestId('action-manage-subscription')).toBeNull();
  });

  it('treats a Test Store purchase as a test purchase, not a Google Play subscription', async () => {
    await boot('pro', { store: 'TEST_STORE', managementURL: null });
    const view = await renderScreen();
    expect(view.queryByTestId('action-manage-subscription')).toBeNull();
    expect(view.getByTestId('pricing-test-store-note')).toBeTruthy();
  });

  it('opens Google Play management only for an active Google Play subscription', async () => {
    await boot('pro');
    const view = await renderScreen();

    await fireEvent.press(view.getByTestId('action-manage-subscription'));

    await waitFor(() => expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('package=com.metriqo.invoice')));
  });

  it('Q. opening, using and leaving the screen never opens Google Play', async () => {
    await boot();
    h.adapter.restoreResult = activeInfo('starter', h.clock.now, { store: 'TEST_STORE' });
    const view = await renderScreen();
    await fireEvent.press(view.getByTestId('action-restore-purchases'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Purchases restored', expect.stringContaining('Starter')));
    h.adapter.onPurchase = () => activeInfo('pro', h.clock.now, { store: 'TEST_STORE' });
    await fireEvent.press(view.getByTestId('plan-pro-cta'));
    await waitFor(() => expect(h.adapter.calls.purchase).toHaveLength(1));

    await view.unmount(); // back navigation

    expect(openUrl).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('presents Customer Center and re-syncs afterwards', async () => {
    await boot();
    const view = await renderScreen();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));

    await fireEvent.press(view.getByTestId('action-customer-center'));

    await waitFor(() => expect(h.adapter.calls.presentCustomerCenter).toBe(1));
    await waitFor(() => expect(view.getByTestId('pricing-current-plan').props.children).toBe('Starter'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('says so when Customer Center cannot be opened', async () => {
    await boot();
    const view = await renderScreen();
    h.adapter.available = false;

    await fireEvent.press(view.getByTestId('action-customer-center'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Not available', expect.any(String)));
  });

  it('offers an "Upgrade now" paywall shortcut on the reason banner and unlocks on purchase', async () => {
    await boot();
    const view = await renderScreen({ reason: 'invoice_limit' });
    h.adapter.paywallResult = 'purchased';
    h.adapter.onPaywallPresented = () => activeInfo('pro', h.clock.now);

    await fireEvent.press(view.getByTestId('pricing-reason-upgrade'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Pro is active', expect.any(String)));
    expect(view.getByTestId('pricing-current-plan').props.children).toBe('Pro');
  });

  it('shows no alert when the paywall is simply dismissed', async () => {
    await boot();
    const view = await renderScreen({ reason: 'invoice_limit' });
    h.adapter.paywallResult = 'cancelled';

    await fireEvent.press(view.getByTestId('pricing-reason-upgrade'));

    await waitFor(() => expect(h.adapter.calls.presentPaywall).toBe(1));
    expect(Alert.alert).not.toHaveBeenCalled();
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
