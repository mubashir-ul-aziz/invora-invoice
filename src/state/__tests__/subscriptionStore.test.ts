import { InMemoryUserIdentityRepository } from '@/data/identity/InMemoryUserIdentityRepository';
import { IdentityService } from '@/data/identity/IdentityService';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { DAY, activeInfo, makeHarness } from '@/data/subscription/testFixtures';

import { createSubscriptionStore } from '../subscriptionStore';

/** A fake identity service so tests never touch the real SQLite/expo-crypto-backed default. */
function makeIdentity(seed: ConstructorParameters<typeof InMemoryUserIdentityRepository>[0] = null) {
  let nextId = 0;
  const repository = new InMemoryUserIdentityRepository(seed);
  const service = new IdentityService(repository, () => `guest-${(nextId += 1)}`, () => 1_000);
  return { repository, service };
}

function setup() {
  const h = makeHarness();
  const invoices = new InMemoryInvoiceRepository();
  const tracker = new InvoiceUsageTracker(invoices, h.cache, () => h.clock.now);
  const entitlement = new EntitlementService(h.service, tracker, () => h.clock.now);
  const openUrl = jest.fn().mockResolvedValue(true);
  const identity = makeIdentity();
  const store = createSubscriptionStore(
    () => h.service,
    () => entitlement,
    openUrl,
    () => identity.service,
  );
  return { ...h, invoices, entitlement, store, openUrl, identity };
}

describe('subscriptionStore', () => {
  it('starts unresolved so nothing is treated as locked before the cached plan is read', () => {
    const { store } = setup();
    expect(store.getState().resolved).toBe(false);
    expect(store.getState().snapshot.plan).toBe('free');
  });

  it('init reads the cache, syncs with RevenueCat and loads invoice usage', async () => {
    const s = setup();
    s.adapter.setCustomerInfo(activeInfo('business', s.clock.now));

    await s.store.getState().init();

    const state = s.store.getState();
    expect(state.resolved).toBe(true);
    expect(state.snapshot.plan).toBe('business');
    expect(state.displayStatus).toBe('ACTIVE');
    expect(state.usage).toMatchObject({ used: 0, limit: 40 });
  });

  it('init creates a guest identity (no sign-in prompt) and logs it in to RevenueCat', async () => {
    const s = setup();

    await s.store.getState().init();

    const identity = await s.identity.repository.read();
    expect(identity).toMatchObject({ accountType: 'guest', authProvider: 'local' });
    expect(s.adapter.calls.logIn).toEqual([identity!.localUserId]);
  });

  it('never loses an anonymous entitlement while establishing the guest identity on startup', async () => {
    const s = setup();
    s.adapter.setCustomerInfo(activeInfo('pro', s.clock.now));

    await s.store.getState().init();

    expect(s.store.getState().snapshot.plan).toBe('pro');
    expect(s.adapter.calls.restore).toBe(0); // RevenueCat's own aliasing carries it over — no manual restore needed
  });

  it('init only runs once', async () => {
    const s = setup();
    await s.store.getState().init();
    await s.store.getState().init();
    expect(s.adapter.calls.getCustomerInfo).toBe(1);
  });

  it('keeps the last known paid plan when the app starts offline', async () => {
    const s = setup();
    s.adapter.setCustomerInfo(activeInfo('pro', s.clock.now));
    await s.service.refresh();

    s.connectivity.setOnline(false);
    const restartedService = s.restart();
    const restarted = createSubscriptionStore(
      () => restartedService,
      () => s.entitlement,
      s.openUrl,
      () => s.identity.service,
    );
    await restarted.getState().init();

    expect(restarted.getState().snapshot.plan).toBe('pro');
    expect(restarted.getState().displayStatus).toBe('OFFLINE');
  });

  it('still becomes resolved (as Free) if the cache cannot be read', async () => {
    const s = setup();
    const broken = {
      subscribe: () => () => undefined,
      startListening: () => () => undefined,
      loadCached: () => Promise.reject(new Error('disk error')),
      refresh: () => Promise.reject(new Error('disk error')),
    } as never;
    const store = createSubscriptionStore(
      () => broken,
      () => s.entitlement,
      s.openUrl,
      () => s.identity.service,
    );

    await store.getState().init();

    expect(store.getState().resolved).toBe(true);
    expect(store.getState().snapshot.plan).toBe('free');
  });

  it('purchase: confirmed success updates the plan; the pending flag stays off', async () => {
    const s = setup();
    await s.store.getState().init();
    s.adapter.onPurchase = () => activeInfo('starter', s.clock.now);

    const outcome = await s.store.getState().purchase('starter', 'monthly');

    expect(outcome.status).toBe('success');
    expect(s.store.getState().snapshot.plan).toBe('starter');
    expect(s.store.getState().purchasePending).toBe(false);
    expect(s.store.getState().purchasing).toBe(false);
  });

  it('purchase: a pending transaction shows PENDING, unlocks nothing, and clears once the plan arrives', async () => {
    const s = setup();
    await s.store.getState().init();
    s.adapter.failNextPurchase('pending');

    const outcome = await s.store.getState().purchase('pro', 'monthly');

    expect(outcome.status).toBe('pending');
    expect(s.store.getState().displayStatus).toBe('PENDING');
    expect(s.store.getState().snapshot.plan).toBe('free');

    // Google Play later confirms; RevenueCat pushes the update.
    s.adapter.emit(activeInfo('pro', s.clock.now));
    await new Promise<void>((resolve) => setImmediate(() => resolve()));

    expect(s.store.getState().snapshot.plan).toBe('pro');
    expect(s.store.getState().purchasePending).toBe(false);
    expect(s.store.getState().displayStatus).toBe('ACTIVE');
  });

  it('restore: shows RESTORING while it runs and returns to normal afterwards', async () => {
    const s = setup();
    await s.store.getState().init();
    s.adapter.restoreResult = activeInfo('business', s.clock.now);

    const pending = s.store.getState().restore();
    expect(s.store.getState().displayStatus).toBe('RESTORING');
    const outcome = await pending;

    expect(outcome.status).toBe('restored');
    expect(s.store.getState().busy).toBeNull();
    expect(s.store.getState().snapshot.plan).toBe('business');
  });

  it('loadOfferings exposes the eight packages, and an error state when they cannot load', async () => {
    const s = setup();
    await s.store.getState().loadOfferings();
    expect(s.store.getState().packages).toHaveLength(8);
    expect(s.store.getState().offeringsStatus).toBe('ready');

    s.adapter.failNext('network');
    await s.store.getState().loadOfferings(true);
    expect(s.store.getState().offeringsStatus).toBe('error');
  });

  it('checkCanCreateInvoice reflects the plan limit and updates usage', async () => {
    const s = setup();
    await s.store.getState().init();

    const decision = await s.store.getState().checkCanCreateInvoice();

    expect(decision.allowed).toBe(true);
    expect(s.store.getState().usage).toMatchObject({ used: 0, limit: 5, remaining: 5 });
  });

  it('refreshes the usage meter whenever an invoice is recorded as created', async () => {
    const s = setup();
    await s.store.getState().init();
    expect(s.store.getState().usage?.used).toBe(0);

    await s.invoices.create('INV-1', {
      customerId: 'c',
      customerName: 'C',
      invoiceTypeId: 'general',
      issueDate: '2026-09-10',
      dueDate: null,
      notes: null,
      terms: null,
      items: [],
    });
    await s.entitlement.recordCreated();
    await new Promise<void>((resolve) => setImmediate(() => resolve()));

    expect(s.store.getState().usage?.used).toBe(1);
  });

  it('opens Google Play management only for an active Play subscription — never the empty generic page', async () => {
    const s = setup();
    expect(await s.store.getState().openManageSubscription()).toBe(false);
    expect(s.openUrl).not.toHaveBeenCalled();

    s.adapter.setCustomerInfo(activeInfo('pro', s.clock.now, { store: 'TEST_STORE' }));
    await s.service.refresh();
    expect(await s.store.getState().openManageSubscription()).toBe(false);
    expect(s.openUrl).not.toHaveBeenCalled();

    s.adapter.setCustomerInfo(activeInfo('pro', s.clock.now));
    await s.service.refresh();
    expect(await s.store.getState().openManageSubscription()).toBe(true);
    expect(s.openUrl).toHaveBeenLastCalledWith(expect.stringContaining('package=com.metriqo.invoice'));
  });

  it('records why offerings failed: unavailable build, offline, or RevenueCat configuration', async () => {
    const s = setup();
    s.adapter.available = false;
    await s.store.getState().loadOfferings(true);
    expect(s.store.getState()).toMatchObject({ offeringsStatus: 'error', offeringsIssue: 'unavailable' });

    s.adapter.available = true;
    s.connectivity.setOnline(false);
    await s.store.getState().loadOfferings(true);
    expect(s.store.getState()).toMatchObject({ offeringsStatus: 'error', offeringsIssue: 'offline' });

    s.connectivity.setOnline(true);
    s.adapter.failNext('configuration');
    await s.store.getState().loadOfferings(true);
    expect(s.store.getState()).toMatchObject({ offeringsStatus: 'error', offeringsIssue: 'configuration' });

    await s.store.getState().loadOfferings(true);
    expect(s.store.getState()).toMatchObject({ offeringsStatus: 'ready', offeringsIssue: null });
    expect(s.store.getState().packages).toHaveLength(8);
  });

  it('presents the paywall and clears `purchasing` once it closes, whatever the outcome', async () => {
    const s = setup();
    await s.store.getState().init();
    s.adapter.paywallResult = 'purchased';
    s.adapter.onPaywallPresented = () => activeInfo('business', s.clock.now);

    const outcome = await s.store.getState().presentPaywall();

    expect(outcome).toMatchObject({ status: 'purchased' });
    expect(s.store.getState().purchasing).toBe(false);
    expect(s.store.getState().snapshot.plan).toBe('business');
  });

  it('presents the customer center and tracks `presentingCustomerCenter` while it is up', async () => {
    const s = setup();
    let sawPresenting = false;
    s.adapter.presentCustomerCenter = async () => {
      sawPresenting = s.store.getState().presentingCustomerCenter;
    };

    const outcome = await s.store.getState().presentCustomerCenter();

    expect(sawPresenting).toBe(true);
    expect(outcome).toEqual({ status: 'shown' });
    expect(s.store.getState().presentingCustomerCenter).toBe(false);
  });

  it('never lets a paid plan lapse silently into Free just because the app went offline', async () => {
    const s = setup();
    s.adapter.setCustomerInfo(activeInfo('unlimited', s.clock.now));
    await s.store.getState().init();

    s.connectivity.setOnline(false);
    s.clock.now += 3 * DAY - 1000;
    await s.store.getState().refresh('foreground');
    expect(s.store.getState().snapshot.plan).toBe('unlimited');

    // …but only for the 3-day offline grace after RevenueCat last verified it.
    s.clock.now += 2000;
    await s.store.getState().refresh('foreground');
    expect(s.store.getState().snapshot.plan).toBe('free');
    expect(s.store.getState().snapshot.trust).toBe('stale');

    // Reconnecting (RevenueCat answers with a fresh server timestamp) restores it immediately.
    s.adapter.setCustomerInfo(activeInfo('unlimited', s.clock.now));
    s.connectivity.setOnline(true);
    await s.store.getState().refresh('foreground');
    expect(s.store.getState().snapshot.plan).toBe('unlimited');
  });
});
