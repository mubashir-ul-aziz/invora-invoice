import { OFFLINE_GRACE_MS } from '@/domain/subscription/offlinePolicy';
import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from '@/domain/subscription/types';

import { InvoiceUsageTracker } from '../InvoiceUsageTracker';
import { SubscriptionCache } from '../SubscriptionCache';
import type { SubscriptionCacheRepository } from '../SubscriptionCacheRepository';

const DAY = 86_400_000;
/** A Tuesday well inside a month, so "+1 month" and "+1 day" land somewhere unambiguous. */
const START = new Date(2026, 9, 15, 12, 0, 0).getTime(); // 2026-10-15

/** Trivial in-memory repository — the signing/tamper-detection layer isn't this test's concern. */
class FakeCacheRepository implements SubscriptionCacheRepository {
  record: SubscriptionCacheRecord | null = null;
  async get(): Promise<SubscriptionCacheRecord | null> {
    return this.record;
  }
  async save(record: SubscriptionCacheRecord): Promise<void> {
    this.record = record;
  }
}

/**
 * A fake `InvoiceRepository` slice backed by real timestamps: `countCreatedBetween`
 * only counts invoices whose recorded `createdAt` actually falls in the queried
 * window, the same as the real SQLite-backed one — so the test can't accidentally
 * pass by having the fake hand back whatever count the assertion expects.
 */
function makeInvoiceRows() {
  const createdAts: number[] = [];
  return {
    createdAts,
    countCreatedBetween: async (startMs: number, endMs: number) =>
      createdAts.filter((t) => t >= startMs && t < endMs).length,
  };
}

function makeHarness(startAt: number = START, seed: Partial<SubscriptionCacheRecord> = {}) {
  const clock = { now: startAt };
  const invoices = makeInvoiceRows();
  const repository = new FakeCacheRepository();
  repository.record = { ...EMPTY_CACHE_RECORD, ...seed };
  const cache = new SubscriptionCache(repository);
  const tracker = new InvoiceUsageTracker(invoices, cache, () => clock.now);

  /** Models `invoiceStore.create()` immediately followed by `EntitlementService.recordCreated()`. */
  const createInvoice = async () => {
    invoices.createdAts.push(clock.now);
    await tracker.recordCreated();
  };

  return { clock, invoices, cache, tracker, createInvoice };
}

describe('InvoiceUsageTracker — device-clock forward-jump protection', () => {
  it('counts invoices created this real month normally (baseline, nothing suspicious)', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    await h.createInvoice();
    await h.createInvoice();

    const usage = await h.tracker.getUsage();

    expect(usage.used).toBe(2);
    expect(usage.period.key).toBe('2026-10');
  });

  it('does NOT hand back a fresh quota when the device clock is jumped forward into next month', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    await h.createInvoice();
    await h.createInvoice();
    await h.createInvoice();
    expect((await h.tracker.getUsage()).used).toBe(3);

    // Attacker sets the phone's date forward to next month, without ever going online again
    // (`lastSyncedAt` stays at the last real, verified sync).
    h.clock.now = new Date(2026, 10, 16, 12, 0, 0).getTime(); // 2026-11-16, +32 days

    const usage = await h.tracker.getUsage();

    // Still October: the unverified jump is capped at `lastSyncedAt + OFFLINE_GRACE_MS`, nowhere
    // near next month, so the period — and the 3 already used — doesn't move.
    expect(usage.period.key).toBe('2026-10');
    expect(usage.used).toBe(3);
  });

  it('still refuses a fresh quota after the attacker also tries to create invoices post-jump', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    await h.createInvoice();
    h.clock.now += 40 * DAY; // jump ~1.3 months forward, still unverified

    // `assertCanCreate`-equivalent path: usage is still read as October's (capped), so a second
    // "invoice" recorded now is correctly counted against October, not a fresh November slot.
    await h.createInvoice();
    const usage = await h.tracker.getUsage();

    expect(usage.period.key).toBe('2026-10');
    expect(usage.used).toBe(2);
  });

  it('grants the new month once RevenueCat actually verifies the device is there', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    await h.createInvoice();
    h.clock.now += 32 * DAY; // 2026-11-16

    // A real sync just corroborated November — `lastSyncedAt` can only move forward via
    // `SubscriptionService.applyCustomerInfo`, never via the device clock alone.
    await h.cache.update((cur) => ({ ...cur, lastSyncedAt: h.clock.now }));

    const usage = await h.tracker.getUsage();

    expect(usage.period.key).toBe('2026-11');
    expect(usage.used).toBe(0);
  });

  it('still allows a genuine same-day month rollover with only a short offline gap', async () => {
    const lastDayOfMonth = new Date(2026, 9, 31, 23, 0, 0).getTime();
    const h = makeHarness(lastDayOfMonth, { lastSyncedAt: lastDayOfMonth });
    await h.createInvoice();
    expect((await h.tracker.getUsage()).used).toBe(1);

    // Midnight naturally ticks over into November a couple of hours later — well within the
    // offline grace, unlike an abrupt multi-week jump.
    h.clock.now = new Date(2026, 10, 1, 2, 0, 0).getTime();

    const usage = await h.tracker.getUsage();

    expect(usage.period.key).toBe('2026-11');
    expect(usage.used).toBe(0);
  });

  it('tolerates the existing offline grace window before capping (matches OFFLINE_GRACE_MS elsewhere)', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    h.clock.now = START + OFFLINE_GRACE_MS - 1000;

    // Still within the grace window from the last verified sync, even though several days passed.
    const usage = await h.tracker.getUsage();
    expect(usage.period.key).toBe('2026-10');
  });

  it('falls back to the plain device clock when RevenueCat has never verified this device (no regression)', async () => {
    // No RevenueCat configured / never been online — nothing to cap against, same as before this fix.
    const h = makeHarness(START, { lastSyncedAt: null });
    await h.createInvoice();
    h.clock.now += 32 * DAY;

    const usage = await h.tracker.getUsage();

    expect(usage.period.key).toBe('2026-11');
    expect(usage.used).toBe(0);
  });

  it('never trusts the clock going backwards, cap or no cap', async () => {
    const h = makeHarness(START, { lastSyncedAt: START });
    await h.createInvoice();
    await h.cache.update((cur) => ({ ...cur, clockHighWaterMs: START + 5 * DAY }));

    h.clock.now = START - 10 * DAY; // rolled back

    const usage = await h.tracker.getUsage();
    expect(usage.period.key).toBe('2026-10'); // still October, from the high-water floor
  });
});
