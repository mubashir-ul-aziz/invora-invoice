import { serializeCacheRecord } from '@/domain/subscription/cacheCodec';
import { EMPTY_CACHE_RECORD } from '@/domain/subscription/types';
import { VERIFICATION_MAX_AGE_MS, evaluateVerification } from '@/domain/subscription/verificationPolicy';

import { InvoiceUsageTracker } from '../InvoiceUsageTracker';
import { DAY, activeInfo, makeHarness } from '../testFixtures';

const HOUR = 3_600_000;

function gate(h: ReturnType<typeof makeHarness>) {
  const { verification, clockHighWaterMs } = h.service.getSnapshot();
  return evaluateVerification({ ...verification, clockHighWaterMs, now: h.clock.now });
}

describe('SubscriptionService — 24-hour verification', () => {
  it('records the first launch once, as the start of the first window', async () => {
    const h = makeHarness();
    await h.service.loadCached();
    const firstLaunch = h.clock.now;

    h.clock.now += HOUR;
    await h.restart().loadCached();

    expect((await h.cache.read()).firstLaunchAt).toBe(firstLaunch);
  });

  it('a fresh RevenueCat answer stamps lastVerifiedAt with RevenueCat’s own time', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { requestDate: h.clock.now - 1000 }));

    await h.service.refresh('startup');

    expect((await h.cache.read()).lastVerifiedAt).toBe(h.clock.now - 1000);
    expect(h.service.getSnapshot().verification).toMatchObject({ enforced: true, lastVerifiedAt: h.clock.now - 1000 });
  });

  it('the SDK’s cached answer (old request date) does not count as a verification', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    const verifiedAt = (await h.cache.read()).lastVerifiedAt;

    h.clock.now += 2 * DAY;
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { requestDate: h.clock.now - 2 * DAY }));
    await h.service.refresh();

    expect((await h.cache.read()).lastVerifiedAt).toBe(verifiedAt);
  });

  it('a failed request does not move lastVerifiedAt', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh();
    const verifiedAt = (await h.cache.read()).lastVerifiedAt;

    h.clock.now += HOUR;
    h.adapter.failNext('network');
    await h.service.refresh();

    expect((await h.cache.read()).lastVerifiedAt).toBe(verifiedAt);
  });

  it('requires verification after 24 hours offline, keeps the cached plan (not expired), and lifts on reconnect', async () => {
    const h = makeHarness();
    await h.service.loadCached();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
    await h.service.refresh();

    h.connectivity.setOnline(false);
    h.clock.now += VERIFICATION_MAX_AGE_MS - HOUR;
    await h.service.refresh();
    expect(gate(h).required).toBe(false);

    h.clock.now += 2 * HOUR;
    await h.service.refresh();
    expect(gate(h)).toMatchObject({ required: true, reason: 'expired_window' });
    expect(h.service.getSnapshot()).toMatchObject({ plan: 'business', status: 'OFFLINE' });

    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
    h.connectivity.setOnline(true); // the reconnect listener refreshes
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    await h.service.refresh();
    expect(gate(h).required).toBe(false);
  });

  it('is not enforced when RevenueCat is not configured in this build', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    await h.service.loadCached();
    h.clock.now += 10 * DAY;
    await h.service.refresh();
    expect(gate(h).required).toBe(false);
  });
});

describe('SubscriptionService.verifyNow ("Refresh Plan")', () => {
  it('reports verified only for a fresh answer', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await expect(h.service.verifyNow()).resolves.toMatchObject({ status: 'verified', snapshot: { plan: 'starter' } });
  });

  it('reports offline (pending, not expired) without calling RevenueCat', async () => {
    const h = makeHarness();
    h.connectivity.setOnline(false);
    const outcome = await h.service.verifyNow();
    expect(outcome.status).toBe('offline');
  });

  it('reports unreachable when RevenueCat fails or only a cached answer comes back', async () => {
    const h = makeHarness();
    h.adapter.failNext('network');
    await expect(h.service.verifyNow()).resolves.toMatchObject({ status: 'unreachable' });

    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now, { requestDate: h.clock.now - DAY }));
    await expect(h.service.verifyNow()).resolves.toMatchObject({ status: 'unreachable' });
  });

  it('reports unavailable when RevenueCat is not configured', async () => {
    const h = makeHarness();
    h.adapter.available = false;
    await expect(h.service.verifyNow()).resolves.toMatchObject({ status: 'unavailable' });
  });
});

describe('subscription cache signature compatibility', () => {
  it('a row signed before the verification fields existed still verifies (same bytes)', () => {
    const legacy = { ...EMPTY_CACHE_RECORD, plan: 'pro' as const, isActive: true, source: 'revenuecat' as const };
    expect(serializeCacheRecord(legacy)).toBe(
      JSON.stringify(['pro', 1, null, 0, 0, null, null, 'revenuecat', 0, null, null, null]),
    );
  });

  it('hand-clearing lastVerifiedAt changes the signed bytes, so the row is rejected', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
    await h.service.loadCached();
    await h.service.refresh();

    h.rawStore.tamper({ lastVerifiedAt: null, firstLaunchAt: null });

    await expect(h.cache.read()).resolves.toEqual(EMPTY_CACHE_RECORD);
  });
});

describe('invoice usage after a backup import', () => {
  it('keeps this device’s monthly count even when the restored data has fewer invoices this month', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();
    let rowsThisMonth = 4;
    const tracker = new InvoiceUsageTracker({ countCreatedBetween: async () => rowsThisMonth }, h.cache, () => h.clock.now);
    await tracker.recordCreated();
    expect((await tracker.getUsage()).used).toBe(4);

    rowsThisMonth = 1; // a backup with fewer invoices this month replaced the data
    expect((await tracker.getUsage()).used).toBe(4);
    expect((await h.cache.read()).lastVerifiedAt).not.toBeNull();
  });
});
