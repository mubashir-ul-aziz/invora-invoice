/**
 * End-to-end subscription scenarios: store → SubscriptionService →
 * EntitlementService → invoice usage, with only RevenueCat faked. Each case
 * is labelled with the scenario letter from the purchasing-flow audit.
 */
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import type { Invoice } from '@/domain/invoice/types';
import { PLAN_LIMITS } from '@/domain/subscription/plans';
import { createSubscriptionStore } from '@/state/subscriptionStore';

import { EntitlementService } from '../EntitlementService';
import { InvoiceUsageTracker } from '../InvoiceUsageTracker';
import { START, activeInfo, lapsedInfo, makeHarness } from '../testFixtures';

function seedInvoices(count: number): Invoice[] {
  const iso = new Date(START).toISOString();
  return Array.from({ length: count }, (_, i) => ({
    id: `inv_${i}`,
    invoiceNumber: `INV-${i}`,
    customerId: 'cust_1',
    customerName: 'Acme',
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

async function setup(invoiceCount = 0) {
  const h = makeHarness();
  const invoices = new InMemoryInvoiceRepository(seedInvoices(invoiceCount));
  const makeEntitlement = (service = h.service) =>
    new EntitlementService(service, new InvoiceUsageTracker(invoices, h.cache, () => h.clock.now), () => h.clock.now);
  const entitlement = makeEntitlement();
  const openUrl = jest.fn().mockResolvedValue(true);
  const store = createSubscriptionStore(() => h.service, () => entitlement, openUrl, () => ({
    getOrCreateLocalUserId: async () => ({ localUserId: 'guest-1' }) as never,
  }) as never);
  await store.getState().init();
  return { ...h, invoices, entitlement, makeEntitlement, store, openUrl };
}

describe('subscription purchasing flow', () => {
  it('A. Free user with no invoices: 0/5', async () => {
    const s = await setup(0);
    expect(s.store.getState().snapshot.plan).toBe('free');
    expect(s.store.getState().usage).toMatchObject({ used: 0, limit: 5 });
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(true);
  });

  it('B. Free user at 5/5: invoice #6 is blocked', async () => {
    const s = await setup(5);
    const decision = await s.store.getState().checkCanCreateInvoice();
    expect(decision.allowed).toBe(false);
    expect(decision.usage).toMatchObject({ used: 5, limit: 5 });
    await expect(s.entitlement.assertCanCreate()).rejects.toThrow();
  });

  it('C. Free 5/5 buys Starter Monthly → starter, 5/15, invoice #6 allowed immediately', async () => {
    const s = await setup(5);
    s.adapter.onPurchase = (packageId) => {
      expect(packageId).toBe('starter_monthly');
      return activeInfo('starter', s.clock.now, { period: 'monthly', store: 'TEST_STORE' });
    };

    const outcome = await s.store.getState().purchase('starter', 'monthly');

    expect(outcome.status).toBe('success');
    expect(s.store.getState().snapshot.plan).toBe('starter');
    expect(s.store.getState().usage).toMatchObject({ plan: 'starter', used: 5, limit: 15 });
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(true);
    await expect(s.entitlement.assertCanCreate()).resolves.toBeUndefined();
  });

  it('C2. the purchased product is verified from a fresh CustomerInfo when the purchase result lags', async () => {
    const s = await setup(5);
    // Purchase result doesn't carry the entitlement yet; RevenueCat's backend does a moment later.
    s.adapter.onPurchase = () => s.adapter.customerInfo;
    const original = s.adapter.getCustomerInfo.bind(s.adapter);
    s.adapter.getCustomerInfo = async () => {
      if (s.adapter.calls.purchase.length > 0) {
        s.adapter.setCustomerInfo(activeInfo('starter', s.clock.now));
      }
      return original();
    };

    const outcome = await s.store.getState().purchase('starter', 'monthly');

    expect(outcome.status).toBe('success');
    expect(s.store.getState().usage).toMatchObject({ used: 5, limit: 15 });
  });

  it('D. Starter Yearly gives 15 invoices per month — not 180', async () => {
    const s = await setup(0);
    s.adapter.onPurchase = (packageId) => {
      expect(packageId).toBe('starter_yearly');
      return activeInfo('starter', s.clock.now, { period: 'yearly' });
    };
    await s.store.getState().purchase('starter', 'yearly');
    expect(s.store.getState().snapshot.subscription.billingPeriod).toBe('yearly');
    expect(s.store.getState().usage?.limit).toBe(15);
  });

  it.each([
    ['business', 40],
    ['pro', 100],
  ] as const)('E/F. %s gives %i invoices per month (monthly and yearly)', async (plan, limit) => {
    for (const period of ['monthly', 'yearly'] as const) {
      const s = await setup(0);
      s.adapter.onPurchase = () => activeInfo(plan, s.clock.now, { period });
      await s.store.getState().purchase(plan, period);
      expect(s.store.getState().usage?.limit).toBe(limit);
      expect(PLAN_LIMITS[plan]).toBe(limit);
    }
  });

  it('G. Unlimited has no limit', async () => {
    const s = await setup(250);
    s.adapter.onPurchase = () => activeInfo('unlimited', s.clock.now);
    await s.store.getState().purchase('unlimited', 'monthly');
    expect(s.store.getState().usage).toMatchObject({ used: 250, limit: null });
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(true);
  });

  it('H. a cancelled purchase changes nothing', async () => {
    const s = await setup(5);
    s.adapter.failNextPurchase('cancelled');
    expect(await s.store.getState().purchase('starter', 'monthly')).toEqual({ status: 'cancelled' });
    expect(s.store.getState().snapshot.plan).toBe('free');
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(false);
  });

  it('I. a failed purchase reports the failure and unlocks nothing', async () => {
    const s = await setup(5);
    s.adapter.failNextPurchase('unknown');
    expect(await s.store.getState().purchase('pro', 'monthly')).toMatchObject({ status: 'failed' });
    s.adapter.failNextPurchase('configuration');
    expect(await s.store.getState().purchase('pro', 'monthly')).toEqual({ status: 'product_unavailable' });
    expect(s.store.getState().snapshot.plan).toBe('free');
    expect(s.store.getState().purchasing).toBe(false);
  });

  it('K. an offline upgrade attempt never reaches the store and is never faked', async () => {
    const s = await setup(5);
    s.connectivity.setOnline(false);
    expect(await s.store.getState().purchase('starter', 'monthly')).toEqual({ status: 'network_error' });
    expect(s.adapter.calls.purchase).toHaveLength(0);
    expect(s.store.getState().snapshot.plan).toBe('free');
  });

  it('M. restore with an active entitlement restores the plan and the invoice limit', async () => {
    const s = await setup(5);
    s.adapter.restoreResult = activeInfo('business', s.clock.now, { store: 'TEST_STORE' });

    const outcome = await s.store.getState().restore();

    expect(outcome.status).toBe('restored');
    expect(s.adapter.calls.restore).toBe(1);
    expect(s.store.getState().snapshot.plan).toBe('business');
    expect(s.store.getState().usage).toMatchObject({ used: 5, limit: 40 });
    expect(s.openUrl).not.toHaveBeenCalled();
  });

  it('N. restore with no entitlement says nothing was found and stays Free', async () => {
    const s = await setup(0);
    const outcome = await s.store.getState().restore();
    expect(outcome.status).toBe('nothing_to_restore');
    expect(s.store.getState().snapshot.plan).toBe('free');
    expect(s.openUrl).not.toHaveBeenCalled();
  });

  it('N2. restore distinguishes network and store errors', async () => {
    const s = await setup(0);
    s.adapter.failNext('network');
    expect(await s.store.getState().restore()).toEqual({ status: 'network_error' });
    s.adapter.failNext('store_unavailable');
    expect(await s.store.getState().restore()).toEqual({ status: 'store_unavailable' });
    s.adapter.available = false;
    expect(await s.store.getState().restore()).toMatchObject({ status: 'unavailable', reason: expect.any(String) });
  });

  it('O. an expired entitlement falls back to Free and keeps every invoice', async () => {
    const s = await setup(12);
    s.adapter.onPurchase = () => activeInfo('starter', s.clock.now);
    await s.store.getState().purchase('starter', 'monthly');
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(true);

    s.adapter.setCustomerInfo(lapsedInfo('starter', s.clock.now));
    await s.store.getState().refresh('foreground');

    expect(s.store.getState().snapshot.plan).toBe('free');
    expect(s.store.getState().displayStatus).toBe('EXPIRED');
    expect(await s.invoices.countCreatedBetween(0, Number.MAX_SAFE_INTEGER)).toBe(12);
    expect((await s.entitlement.canCreateInvoice()).allowed).toBe(false);
  });

  it('P. after an app restart an active subscription is restored from cache, then re-verified', async () => {
    const s = await setup(5);
    s.adapter.onPurchase = () => activeInfo('pro', s.clock.now);
    await s.store.getState().purchase('pro', 'monthly');

    // Restart offline: the cached, previously verified plan applies immediately.
    s.connectivity.setOnline(false);
    const restarted = s.restart();
    await restarted.loadCached();
    expect(restarted.getSnapshot().plan).toBe('pro');
    expect((await s.makeEntitlement(restarted).getInvoiceUsage()).limit).toBe(100);

    s.connectivity.setOnline(true);
    await restarted.refresh('startup');
    expect(restarted.getSnapshot()).toMatchObject({ plan: 'pro', trust: 'verified' });
  });
});
