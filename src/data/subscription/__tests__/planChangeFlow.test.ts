import type { CustomerInfoLike } from '@/domain/subscription/entitlementMapping';
import { PAID_PLAN_IDS, PLAN_CONFIG, planRank, type BillingPeriod, type PaidPlanId } from '@/domain/subscription/plans';

import { activeInfo, makeHarness, type Harness } from '../testFixtures';

const productOf = (plan: PaidPlanId, period: BillingPeriod = 'monthly') => PLAN_CONFIG[plan].products![period].productId;

/** Every paid → paid transition (12 of them), monthly → monthly. */
const TRANSITIONS: [PaidPlanId, PaidPlanId][] = PAID_PLAN_IDS.flatMap((from) =>
  PAID_PLAN_IDS.filter((to) => to !== from).map((to): [PaidPlanId, PaidPlanId] => [from, to]),
);

/**
 * What the RevenueCat Test Store returns after a plain purchase while another
 * test subscription is active: it can't replace the old one, so both are
 * active and the entitlement points at the newer product.
 */
function testStoreBoth(h: Harness, owned: PaidPlanId, bought: PaidPlanId): CustomerInfoLike {
  const info = activeInfo(bought, h.clock.now, { store: 'TEST_STORE', managementURL: null });
  return { ...info, activeSubscriptions: [productOf(owned), productOf(bought)] };
}

describe('plan changes — RevenueCat Test Store', () => {
  it.each(TRANSITIONS)('%s → %s: plain purchase, no Google Play replacement parameters', async (from, to) => {
    const h = makeHarness();
    h.adapter.storeKind = 'test_store';
    h.adapter.setCustomerInfo(activeInfo(from, h.clock.now, { store: 'TEST_STORE' }));
    await h.service.refresh();
    h.adapter.onPurchase = () => testStoreBoth(h, from, to);

    const outcome = await h.service.purchase(to, 'monthly');

    // 4. The Test Store never receives oldProductId / replacementMode.
    expect(h.adapter.calls.purchase).toEqual([{ packageId: `${to}_monthly`, change: undefined }]);
    // 1–3. Current and target products are detected from CustomerInfo and not confused.
    const log = h.logs[h.logs.length - 1];
    expect(log).toContain('Store environment: test_store');
    expect(log).toContain(`Current plan: ${from} (monthly)`);
    expect(log).toContain(`Current active product ID: ${productOf(from)}`);
    expect(log).toContain(`Target product ID: ${productOf(to)}`);
    expect(log).toContain('oldProductId being passed: none (RevenueCat Test Store cannot replace subscriptions');
    expect(log).toContain('replacementMode: none');
    expect(log).not.toContain(`oldProductId being passed: ${productOf(to)}`);

    // 7–8. The plan only changes from RevenueCat's confirmed CustomerInfo.
    if (planRank(to) > planRank(from)) {
      expect(outcome.status).toBe('success');
      expect(h.service.getSnapshot().plan).toBe(to);
    } else {
      // The old (higher) test subscription is still active; it stays effective until it ends.
      expect(outcome.status).toBe('test_store_overlap');
      expect(h.service.getSnapshot().plan).toBe(from);
    }
  });

  it('treats a product that is already one of the active test subscriptions as already owned', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'test_store';
    h.adapter.setCustomerInfo(testStoreBoth(h, 'business', 'starter'));

    const outcome = await h.service.purchase('starter', 'monthly');

    expect(outcome.status).toBe('already_subscribed');
    expect(h.adapter.calls.purchase).toHaveLength(0);
  });

  it('switches billing period on the same tier', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'test_store';
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now, { store: 'TEST_STORE' }));
    h.adapter.onPurchase = () => ({
      ...activeInfo('business', h.clock.now, { store: 'TEST_STORE', period: 'yearly' }),
      activeSubscriptions: [productOf('business'), productOf('business', 'yearly')],
    });

    const outcome = await h.service.purchase('business', 'yearly');

    expect(h.adapter.calls.purchase[0]).toEqual({ packageId: 'business_yearly', change: undefined });
    expect(h.logs[0]).toContain('Change type: billing_period_change');
    expect(outcome.status).toBe('success');
  });
});

describe('plan changes — Google Play', () => {
  it.each(TRANSITIONS)('%s → %s: replaces the product the user actually owns', async (from, to) => {
    const h = makeHarness();
    h.adapter.storeKind = 'google_play';
    h.adapter.setCustomerInfo(activeInfo(from, h.clock.now));
    const upgrade = planRank(to) > planRank(from);
    // Play applies an upgrade now; a deferred downgrade leaves the old product active until renewal.
    h.adapter.onPurchase = () => (upgrade ? activeInfo(to, h.clock.now) : h.adapter.customerInfo);

    const outcome = await h.service.purchase(to, 'monthly');

    // 5. The OLD product is the owned one — never the target.
    expect(h.adapter.calls.purchase).toEqual([
      {
        packageId: `${to}_monthly`,
        change: { oldProductIdentifier: productOf(from), timing: upgrade ? 'immediate' : 'deferred' },
      },
    ]);
    const log = h.logs[h.logs.length - 1];
    expect(log).toContain('Store environment: google_play');
    expect(log).toContain(`Change type: ${upgrade ? 'upgrade' : 'downgrade'}`);
    expect(log).toContain(`oldProductId being passed: ${productOf(from)}`);
    expect(log).toContain(`replacementMode: ${upgrade ? 'WITH_TIME_PRORATION' : 'DEFERRED'}`);
    expect(outcome.status).toBe(upgrade ? 'success' : 'scheduled');
    expect(h.service.getSnapshot().plan).toBe(upgrade ? to : from);
  });

  it('takes the old product from fresh CustomerInfo, not a stale local snapshot', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'google_play';
    h.adapter.setCustomerInfo(activeInfo('pro', h.clock.now));
    await h.service.refresh(); // the app last saw Pro…
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now)); // …but RevenueCat now says Starter
    h.adapter.onPurchase = () => activeInfo('business', h.clock.now);

    const outcome = await h.service.purchase('business', 'monthly');

    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_starter_monthly', timing: 'immediate' });
    expect(outcome.status).toBe('success');
  });

  it('uses the owned yearly product and strips a Play base-plan suffix', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'google_play';
    const owned = activeInfo('business', h.clock.now, { period: 'yearly' });
    h.adapter.setCustomerInfo({ ...owned, activeSubscriptions: ['metriqo_business_yearly:yearly'] });
    h.adapter.onPurchase = () => activeInfo('unlimited', h.clock.now, { period: 'yearly' });

    await h.service.purchase('unlimited', 'yearly');

    expect(h.adapter.calls.purchase[0].change?.oldProductIdentifier).toBe('metriqo_business_yearly');
  });

  it('defers a same-tier monthly → yearly switch (lower day rate) and names the monthly product as old', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'google_play';
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));

    const outcome = await h.service.purchase('business', 'yearly');

    expect(h.adapter.calls.purchase[0].change).toEqual({ oldProductIdentifier: 'metriqo_business_monthly', timing: 'deferred' });
    expect(h.logs[0]).toContain('Change type: billing_period_change');
    expect(outcome.status).toBe('scheduled');
  });

  it('sends no replacement for a first purchase', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'google_play';
    h.adapter.onPurchase = () => activeInfo('starter', h.clock.now);

    const outcome = await h.service.purchase('starter', 'monthly');

    expect(h.adapter.calls.purchase[0]).toEqual({ packageId: 'starter_monthly', change: undefined });
    expect(h.logs[0]).toContain('oldProductId being passed: none (first purchase');
    expect(outcome.status).toBe('success');
  });
});

describe('plan changes — failures keep the current plan', () => {
  it.each(['test_store', 'google_play'] as const)('%s: a rejected Starter → Business purchase leaves Starter in place', async (store) => {
    const h = makeHarness();
    h.adapter.storeKind = store;
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();
    h.adapter.failNextPurchase('not_allowed');

    const outcome = await h.service.purchase('business', 'monthly');

    expect(outcome.status).toBe('failed');
    expect(h.service.getSnapshot().plan).toBe('starter');
    expect((await h.cache.read()).plan).toBe('starter');
  });

  it('does not purchase when the current subscription cannot be read from RevenueCat', async () => {
    const h = makeHarness();
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now));
    await h.service.refresh();
    h.adapter.failNext('network'); // the pre-purchase CustomerInfo fetch

    const outcome = await h.service.purchase('business', 'monthly');

    expect(outcome.status).toBe('network_error');
    expect(h.adapter.calls.purchase).toHaveLength(0);
    expect(h.service.getSnapshot().plan).toBe('starter');
  });

  it('reports pending (not success) when RevenueCat never lists the bought product', async () => {
    const h = makeHarness();
    h.adapter.storeKind = 'test_store';
    h.adapter.setCustomerInfo(activeInfo('starter', h.clock.now, { store: 'TEST_STORE' }));
    // The store call resolves, but CustomerInfo still only has Starter.

    const outcome = await h.service.purchase('business', 'monthly');

    expect(outcome.status).toBe('pending');
    expect(h.service.getSnapshot().plan).toBe('starter');
  });
});
