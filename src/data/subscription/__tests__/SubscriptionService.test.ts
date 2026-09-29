import { OFFLINE_GRACE_MS } from '@/domain/subscription/offlinePolicy';

import { FakeSubscriptionCacheSigner } from '../InMemorySubscriptionCache';
import { SignedSubscriptionCacheRepository } from '../SignedSubscriptionCacheRepository';
import { SubscriptionCache } from '../SubscriptionCache';
import { SubscriptionService } from '../SubscriptionService';
import { DAY, EMPTY_CUSTOMER_INFO, activeInfo, lapsedInfo, makeHarness } from '../testFixtures';

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('SubscriptionService — refresh and offline behaviour', () => {
  it('starts as Free with an UNKNOWN status before anything has synced', async () => {
    const h = makeHarness();
    const snapshot = await h.service.loadCached();
    expect(snapshot.plan).toBe('free');
    expect(snapshot.status).toBe('UNKNOWN');
    expect(snapshot.trust).toBe('none');
  });

  it('takes the plan from RevenueCat and caches only the normalized state', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));

    const snapshot = await h.service.refresh('startup');

    expect(snapshot).toMatchObject({ plan: 'business', status: 'ACTIVE', trust: 'verified', isOffline: false });
    expect(snapshot.subscription).toMatchObject({ plan: 'business', isActive: true, willRenew: true, billingPeriod: 'monthly' });

    const stored = await h.rawStore.read();
    expect(stored?.record.plan).toBe('business');
    // Only normalized fields are persisted — no raw CustomerInfo/purchase blobs.
    expect(Object.keys(stored!.record).sort()).toEqual(
      [
        'billingIssue',
        'billingPeriod',
        'clockHighWaterMs',
        'expiresAt',
        'isActive',
        'lastSyncedAt',
        'plan',
        'revenueCatUserId',
        'source',
        'usage',
        'willRenew',
      ].sort(),
    );
  });

  it('keeps a paid plan after an app restart with no network (offline-first)', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();

    h.connectivity.setOnline(false);
    h.clock.now += 2 * DAY;
    const restarted = h.restart();
    const cold = await restarted.loadCached();
    expect(cold.plan).toBe('pro');
    expect(cold.trust).toBe('cached');

    const refreshed = await restarted.refresh('startup');
    expect(refreshed.plan).toBe('pro');
    expect(refreshed.isOffline).toBe(true);
    expect(refreshed.status).toBe('OFFLINE');
    expect(h.adapter.calls.getCustomerInfo).toBe(1); // the offline refresh never hit RevenueCat
  });

  it('does not downgrade a paid user when RevenueCat errors', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();

    h.adapter.failNext('network');
    h.clock.now += DAY;
    const snapshot = await h.service.refresh();

    expect(snapshot.plan).toBe('starter');
    expect(snapshot.isOffline).toBe(true);
  });

  it('honours a verified RevenueCat "free" answer immediately (RevenueCat is the authority)', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
    await h.service.refresh();

    h.clock.now += DAY;
    h.adapter.setCustomerInfo(lapsedInfo('business', h.clock.now));
    const snapshot = await h.service.refresh();

    expect(snapshot.plan).toBe('free');
    expect(snapshot.status).toBe('EXPIRED');
  });

  it('falls back to Free once an offline paid cache is past expiry + grace', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now, { expiresAt: h.clock.now + DAY }));
    await h.service.refresh();

    h.connectivity.setOnline(false);
    h.clock.now += DAY + OFFLINE_GRACE_MS + 1000;
    const restarted = h.restart();
    const snapshot = await restarted.loadCached();

    expect(snapshot.plan).toBe('free');
    expect(snapshot.trust).toBe('expired');
  });

  it('flags cancelled-but-active and billing-issue states without removing access', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { willRenew: false }));
    expect((await h.service.refresh()).status).toBe('CANCELLED_BUT_ACTIVE');

    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { billingIssue: true }));
    const billing = await h.service.refresh();
    expect(billing.status).toBe('BILLING_ISSUE');
    expect(billing.plan).toBe('pro');
  });

  it('runs on Free/cached state, calling nothing, when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    const snapshot = await h.service.refresh();
    expect(snapshot.plan).toBe('free');
    expect(h.adapter.calls.getCustomerInfo).toBe(0);
  });

  it('treats an SDK-cache answer (old server timestamp) as cached, not freshly verified', async () => {
    const h = makeHarness();
    const stale = activeInfo('pro', h.clock.now, { requestDate: h.clock.now - 3 * DAY });
    h.adapter.setCustomerInfo(stale);

    const snapshot = await h.service.refresh();

    expect(snapshot.plan).toBe('pro');
    expect(snapshot.trust).toBe('cached');
    expect(snapshot.isOffline).toBe(true);
    // lastSyncedAt reflects when RevenueCat really answered, so staleness is measured honestly.
    expect(snapshot.subscription.lastSyncedAt).toBe(h.clock.now - 3 * DAY);
  });

  it("uses RevenueCat's clock to heal a poisoned high-water mark", async () => {
    const h = makeHarness();
    await h.cache.update((cur) => ({ ...cur, clockHighWaterMs: h.clock.now + 400 * DAY }));
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));

    const snapshot = await h.service.refresh();

    expect(snapshot.clockHighWaterMs).toBe(h.clock.now);
  });

  it('refreshes when RevenueCat pushes an update and when connectivity returns', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();
    const stop = h.service.startListening();

    h.adapter.emit(activeInfo('unlimited', h.clock.now));
    await flush();
    expect(h.service.getSnapshot().plan).toBe('unlimited');

    h.connectivity.setOnline(false);
    expect(h.service.getSnapshot().isOffline).toBe(true);
    const before = h.adapter.calls.getCustomerInfo;
    h.connectivity.setOnline(true);
    await flush();
    expect(h.adapter.calls.getCustomerInfo).toBe(before + 1);
    expect(h.service.getSnapshot().isOffline).toBe(false);

    stop();
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await Promise.all([h.service.refresh(), h.service.refresh(), h.service.refresh()]);
    expect(h.adapter.calls.getCustomerInfo).toBe(1);
  });
});

describe('SubscriptionService — cache integrity', () => {
  it('ignores a cache row edited by hand to grant Unlimited', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();

    h.rawStore.tamper({ plan: 'unlimited', expiresAt: h.clock.now + 999 * DAY });
    const snapshot = await h.restart().loadCached();

    expect(snapshot.plan).toBe('free');
    expect(snapshot.trust).toBe('none');
  });

  it('ignores a cache copied from another device (different secret)', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();

    const otherDevice = new SubscriptionService(
      h.adapter,
      new SubscriptionCache(new SignedSubscriptionCacheRepository(h.rawStore, new FakeSubscriptionCacheSigner('other-device'))),
      h.connectivity,
      () => h.clock.now,
    );

    expect((await otherDevice.loadCached()).plan).toBe('free');
  });

  it('fails closed to Free if secure storage is unavailable', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();

    h.signer.failing = true;
    expect((await h.restart().loadCached()).plan).toBe('free');
  });

  it('never grants a paid plan from an empty database', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    h.connectivity.setOnline(false);
    expect((await h.service.refresh()).plan).toBe('free');
  });
});

describe('SubscriptionService — purchase', () => {
  it('reports success only once RevenueCat returns an active entitlement for the plan', async () => {
    const h = makeHarness();
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now, { period: 'yearly' });

    const outcome = await h.service.purchase('business', 'yearly');

    expect(h.adapter.calls.purchase).toEqual([{ packageId: 'business_yearly', change: undefined }]);
    expect(outcome.status).toBe('success');
    expect(h.service.getSnapshot().plan).toBe('business');
    expect(h.service.getSnapshot().subscription.billingPeriod).toBe('yearly');
  });

  it('does NOT report success when the store call returns without an active entitlement', async () => {
    const h = makeHarness();
    h.adapter.onPurchase = () => EMPTY_CUSTOMER_INFO;

    const outcome = await h.service.purchase('pro', 'monthly');

    expect(outcome.status).toBe('pending');
    expect(h.service.getSnapshot().plan).toBe('free');
  });

  it('does not unlock a plan lower than the one bought', async () => {
    const h = makeHarness();
    h.adapter.onPurchase = () => activeInfo('starter', h.clock.now);
    expect((await h.service.purchase('pro', 'monthly')).status).toBe('pending');
  });

  it.each([
    ['cancelled', 'cancelled'],
    ['network', 'network_error'],
    ['store_unavailable', 'store_unavailable'],
    ['product_unavailable', 'product_unavailable'],
    ['pending', 'pending'],
    ['not_configured', 'unavailable'],
  ] as const)('maps a %s store error to "%s" and leaves the plan alone', async (kind, expected) => {
    const h = makeHarness();
    h.adapter.failNext(kind);
    const outcome = await h.service.purchase('starter', 'monthly');
    expect(outcome.status).toBe(expected);
    expect(h.service.getSnapshot().plan).toBe('free');
  });

  it('reports an unexpected failure with its message', async () => {
    const h = makeHarness();
    h.adapter.failNext('unknown');
    const outcome = await h.service.purchase('starter', 'monthly');
    expect(outcome).toEqual({ status: 'failed', message: 'fake unknown error' });
  });

  it('refuses to start a purchase while offline, without calling the store', async () => {
    const h = makeHarness();
    h.connectivity.setOnline(false);
    expect((await h.service.purchase('starter', 'monthly')).status).toBe('network_error');
    expect(h.adapter.calls.purchase).toHaveLength(0);
  });

  it('is unavailable when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    expect((await h.service.purchase('starter', 'monthly')).status).toBe('unavailable');
  });

  it('does not buy a plan the user already has', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { period: 'yearly' }));
    await h.service.refresh();

    const outcome = await h.service.purchase('pro', 'yearly');

    expect(outcome.status).toBe('already_subscribed');
    expect(h.adapter.calls.purchase).toHaveLength(0);
  });

  it('recovers "already purchased" by refreshing from RevenueCat', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    h.adapter.failNext('already_purchased');
    // The failed purchase consumes the injected failure; refresh then reads the entitlement.
    const outcome = await h.service.purchase('starter', 'monthly');
    expect(outcome.status).toBe('already_subscribed');
    expect(h.service.getSnapshot().plan).toBe('starter');
  });

  it('upgrades by replacing the existing Play subscription, applied immediately', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now);

    const outcome = await h.service.purchase('business', 'monthly');

    expect(h.adapter.calls.purchase[0]).toEqual({
      packageId: 'business_monthly',
      change: { oldProductIdentifier: 'metriqo_starter', timing: 'immediate' },
    });
    expect(outcome.status).toBe('success');
  });

  it('schedules a downgrade for the next renewal instead of claiming it took effect', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    // Play accepts the deferred change; the entitlement stays Pro until renewal.

    const outcome = await h.service.purchase('starter', 'monthly');

    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_pro', timing: 'deferred' });
    expect(outcome.status).toBe('scheduled');
    expect(h.service.getSnapshot().plan).toBe('pro');
  });

  it('ranks an upgrade/downgrade by the real loaded store price, not just the fallback reference price', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    // Reference prices (fallbackPriceUsd) rank Business ($10/mo) below Pro ($15/mo) — an ordinary
    // downgrade. Give Business a real, regionally-priced package that actually costs more per day.
    h.adapter.packages = h.adapter.packages.map((pkg) =>
      pkg.plan === 'business' && pkg.period === 'monthly' ? { ...pkg, priceMicros: 20_000_000 } : pkg,
    );
    await h.service.getOfferings();
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now);

    const outcome = await h.service.purchase('business', 'monthly');

    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_pro', timing: 'immediate' });
    expect(outcome.status).toBe('success');
  });

  it('falls back to the reference price when offerings were never loaded (same as before real prices existed)', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now);

    const outcome = await h.service.purchase('business', 'monthly');

    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_pro', timing: 'deferred' });
    expect(outcome.status).toBe('scheduled');
  });
});

describe('SubscriptionService — restore', () => {
  it('restores a subscription found on the Google account', async () => {
    const h = makeHarness();
    h.adapter.restoreResult = activeInfo('business', h.clock.now);

    const outcome = await h.service.restore();

    expect(outcome.status).toBe('restored');
    expect(h.service.getSnapshot().plan).toBe('business');
  });

  it('says so when there is nothing to restore', async () => {
    const h = makeHarness();
    h.adapter.restoreResult = EMPTY_CUSTOMER_INFO;
    const outcome = await h.service.restore();
    expect(outcome.status).toBe('nothing_to_restore');
    expect(h.service.getSnapshot().plan).toBe('free');
  });

  it('reports an already-active subscription instead of a fake restore', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    h.adapter.restoreResult = activeInfo('pro', h.clock.now);

    expect((await h.service.restore()).status).toBe('already_active');
  });

  it('handles network and store errors', async () => {
    const h = makeHarness();
    h.adapter.failNext('network');
    expect((await h.service.restore()).status).toBe('network_error');
    h.adapter.failNext('store_unavailable');
    expect((await h.service.restore()).status).toBe('store_unavailable');
    h.connectivity.setOnline(false);
    expect((await h.service.restore()).status).toBe('network_error');
  });

  it('does not restore anything when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    expect((await h.service.restore()).status).toBe('unavailable');
  });
});

describe('SubscriptionService — offerings and management', () => {
  it('loads the eight packages and caches them in memory', async () => {
    const h = makeHarness();
    const packages = await h.service.getOfferings();
    expect(packages).toHaveLength(8);
    await h.service.getOfferings();
    expect(h.adapter.calls.getOfferings).toBe(1);
    await h.service.getOfferings(true);
    expect(h.adapter.calls.getOfferings).toBe(2);
  });

  it('rejects when offerings cannot be loaded', async () => {
    const h = makeHarness();
    h.adapter.failNext('network');
    await expect(h.service.getOfferings()).rejects.toMatchObject({ kind: 'network' });
  });

  it("prefers RevenueCat's management URL, and otherwise uses Google's subscriptions page", async () => {
    const h = makeHarness();
    expect(h.service.getManagementUrl()).toBe('https://play.google.com/store/account/subscriptions');
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    expect(h.service.getManagementUrl()).toContain('package=com.metriqo.invoice');
  });

  it('never opens a management link that is not https', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo({ ...activeInfo('pro', h.clock.now), managementURL: 'intent://evil' });
    await h.service.refresh();
    expect(h.service.getManagementUrl()).toBe('https://play.google.com/store/account/subscriptions');
  });
});

describe('SubscriptionService — presentPaywall', () => {
  it('trusts a purchase confirmed by the paywall itself, without re-checking the plan rank', async () => {
    const h = makeHarness();
    h.adapter.paywallResult = 'purchased';
    h.adapter.onPaywallPresented = () => activeInfo('business', h.clock.now);

    const outcome = await h.service.presentPaywall();

    expect(outcome).toMatchObject({ status: 'purchased' });
    expect(h.service.getSnapshot().plan).toBe('business');
  });

  it('refreshes the snapshot after a restore inside the paywall', async () => {
    const h = makeHarness();
    h.adapter.paywallResult = 'restored';
    h.adapter.onPaywallPresented = () => activeInfo('starter', h.clock.now);

    const outcome = await h.service.presentPaywall();

    expect(outcome).toMatchObject({ status: 'restored' });
    expect(h.service.getSnapshot().plan).toBe('starter');
  });

  it('reports a plain dismissal without touching the snapshot', async () => {
    const h = makeHarness();
    h.adapter.paywallResult = 'cancelled';

    const outcome = await h.service.presentPaywall();

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(h.adapter.calls.getCustomerInfo).toBe(0);
  });

  it('reports not_presented as-is', async () => {
    const h = makeHarness();
    h.adapter.paywallResult = 'not_presented';
    expect(await h.service.presentPaywall()).toEqual({ status: 'not_presented' });
  });

  it('maps a paywall-internal error to failed', async () => {
    const h = makeHarness();
    h.adapter.paywallResult = 'error';
    expect(await h.service.presentPaywall()).toEqual({ status: 'failed', message: 'The paywall could not be shown.' });
  });

  it('is unavailable when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    expect(await h.service.presentPaywall()).toEqual({ status: 'unavailable' });
  });

  it('does not throw when the adapter rejects', async () => {
    const h = makeHarness();
    h.adapter.failNext('network');
    const outcome = await h.service.presentPaywall();
    expect(outcome.status).toBe('failed');
  });
});

describe('SubscriptionService — presentCustomerCenter', () => {
  it('refreshes the snapshot after the customer center closes', async () => {
    const h = makeHarness();
    await h.service.refresh();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));

    const outcome = await h.service.presentCustomerCenter();

    expect(outcome).toEqual({ status: 'shown' });
    expect(h.adapter.calls.presentCustomerCenter).toBe(1);
    expect(h.service.getSnapshot().plan).toBe('pro'); // picked up via the explicit refresh, not just the listener
  });

  it('is unavailable when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    expect(await h.service.presentCustomerCenter()).toEqual({ status: 'unavailable' });
  });

  it('reports failure without throwing', async () => {
    const h = makeHarness();
    h.adapter.failNext('unknown');
    const outcome = await h.service.presentCustomerCenter();
    expect(outcome.status).toBe('failed');
  });
});

describe('SubscriptionService — identifyUser (Account + Subscription Identity)', () => {
  it('identifies a fresh guest with no prior purchases', async () => {
    const h = makeHarness();
    const outcome = await h.service.identifyUser('guest-1');

    expect(outcome.status).toBe('identified');
    expect(h.adapter.calls.logIn).toEqual(['guest-1']);
    expect(h.service.getSnapshot().plan).toBe('free');
  });

  it(
    "carries an existing (anonymous) entitlement over automatically via RevenueCat's own aliasing " +
      '— the reinstall/upgrade migration path, no manual restore needed',
    async () => {
      const h = makeHarness();
      // Models an install that already purchased anonymously, before this
      // identity model existed. `localUserId` is freshly generated, so
      // RevenueCat has never seen it — logging in to it auto-aliases the
      // current (anonymous) session, carrying its entitlement over.
      h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));

      const outcome = await h.service.identifyUser('guest-1');

      expect(h.adapter.calls.logIn).toEqual(['guest-1']);
      expect(h.adapter.calls.restore).toBe(0);
      expect(outcome.status).toBe('identified');
      expect(h.service.getSnapshot().plan).toBe('pro');
      expect(h.service.getSnapshot().subscription.isActive).toBe(true);
    },
  );

  it('switches to an identity that already has its own separate RevenueCat history, instead of merging', async () => {
    const h = makeHarness();
    // The current (anonymous) session has its own, different entitlement...
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    // ...but `guest-1` already has a separate RevenueCat record of its own
    // (e.g. a previously-linked account) — RevenueCat does not merge here.
    h.adapter.seedCustomerForUser('guest-1', activeInfo('business', h.clock.now));

    const outcome = await h.service.identifyUser('guest-1');

    expect(outcome.status).toBe('identified');
    expect(h.service.getSnapshot().plan).toBe('business');
  });

  it('is a no-op on a later call with the same identity', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.identifyUser('guest-1');

    const outcome = await h.service.identifyUser('guest-1');

    expect(outcome.status).toBe('already_identified');
    expect(h.adapter.calls.logIn).toEqual(['guest-1']); // not called a second time
  });

  it('remembers the identity across an app restart, so identify stays a no-op', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.identifyUser('guest-1');

    const restarted = h.restart();
    await restarted.loadCached();
    const outcome = await restarted.identifyUser('guest-1');

    expect(outcome.status).toBe('already_identified');
    expect(h.adapter.calls.logIn).toEqual(['guest-1']);
  });

  it('refuses to identify while offline, without contacting RevenueCat', async () => {
    const h = makeHarness();
    h.connectivity.setOnline(false);

    const outcome = await h.service.identifyUser('guest-1');

    expect(outcome.status).toBe('network_error');
    expect(h.adapter.calls.logIn).toHaveLength(0);
  });

  it('is unavailable when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;

    expect((await h.service.identifyUser('guest-1')).status).toBe('unavailable');
  });

  it('keeps recording the identity through subsequent purchase/restore calls', async () => {
    const h = makeHarness();
    await h.service.identifyUser('guest-1');
    h.adapter.onPurchase = () => activeInfo('starter', h.clock.now);

    await h.service.purchase('starter', 'monthly');

    const stored = await h.rawStore.read();
    expect(stored?.record.revenueCatUserId).toBe('guest-1');
  });

  it('keeps offline grace-period behaviour intact for an identified user', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now, { expiresAt: h.clock.now + DAY }));
    await h.service.identifyUser('guest-1');
    await h.service.refresh();

    h.connectivity.setOnline(false);
    h.clock.now += DAY + OFFLINE_GRACE_MS + 1000;
    const restarted = h.restart();
    const snapshot = await restarted.loadCached();

    expect(snapshot.plan).toBe('free');
    expect(snapshot.trust).toBe('expired');
  });
});

describe('SubscriptionService — clearIdentity (logout / account switching)', () => {
  it('returns RevenueCat to anonymous and clears the recorded identity', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.identifyUser('guest-1');

    await h.service.clearIdentity();

    expect(h.adapter.calls.logOut).toBe(1);
    expect(h.service.getSnapshot().plan).toBe('free');
    const stored = await h.rawStore.read();
    expect(stored?.record.revenueCatUserId).toBeNull();
  });

  it('never throws when RevenueCat is unavailable', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    await expect(h.service.clearIdentity()).resolves.toBeUndefined();
  });
});
