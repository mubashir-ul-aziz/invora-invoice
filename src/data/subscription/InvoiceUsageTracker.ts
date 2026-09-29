import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import { getUsagePeriod, mergeUsageCount, nextUsageLedger, type UsagePeriod } from '@/domain/subscription/invoiceAccess';
import { OFFLINE_GRACE_MS, effectiveNow } from '@/domain/subscription/offlinePolicy';
import type { SubscriptionCacheRecord } from '@/domain/subscription/types';

import type { SubscriptionCache } from './SubscriptionCache';

export interface InvoiceUsageReading {
  used: number;
  period: UsagePeriod;
}

/**
 * Counts invoices created in the current calendar month, from SQLite (the
 * invoice table is the local source of truth) — merged with the monotonic
 * counter kept in the subscription cache so deleting an invoice can't hand a
 * monthly slot back. See `mergeUsageCount`. Reads never touch RevenueCat, so
 * limits keep working offline.
 */
export class InvoiceUsageTracker {
  constructor(
    private readonly invoices: Pick<InvoiceRepository, 'countCreatedBetween'>,
    private readonly cache: SubscriptionCache,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * The clock used to decide which calendar month is "current" for quota
   * purposes. Floored by `clockHighWaterMs` like everywhere else (a
   * rolled-back clock gains nothing) but, unlike the entitlement side, also
   * capped at `lastSyncedAt + OFFLINE_GRACE_MS`.
   *
   * `clockHighWaterMs` alone isn't enough here: it's raised by *unverified*
   * device time on every `recordCreated()`/`touchClock()` call, so a device
   * clock pushed forward is trusted immediately. That's harmless for
   * entitlement (a forward jump only ever pushes a cached plan *toward*
   * expiry/staleness sooner), but for a usage counter a forward jump is
   * exploitable: moving the date into next month zeroes the invoice count
   * (no rows exist yet, and the ledger's period key no longer matches) and
   * hands back a fresh quota. `lastSyncedAt`, by contrast, is only ever set
   * from RevenueCat's own `requestDateMillis` after a real response (see
   * `SubscriptionService.applyCustomerInfo`) — advancing the device clock
   * offline can't move it. Capping the usage clock to what that verified
   * timestamp can support (plus the same offline grace already used for
   * subscription expiry) blocks the instant-jump exploit while still letting
   * a genuine month rollover through as long as RevenueCat has been reachable
   * within the grace window. Never synced (RevenueCat unavailable, e.g. on a
   * build without it configured) falls back to the plain floored clock —
   * unchanged from before, since there's no verified anchor to cap against.
   */
  private usageNow(record: SubscriptionCacheRecord): number {
    const floored = effectiveNow(this.now(), record.clockHighWaterMs);
    return record.lastSyncedAt === null ? floored : Math.min(floored, record.lastSyncedAt + OFFLINE_GRACE_MS);
  }

  async getUsage(): Promise<InvoiceUsageReading> {
    const record = await this.cache.read();
    const period = getUsagePeriod(this.usageNow(record));
    const rows = await this.invoices.countCreatedBetween(period.startMs, period.endMs);
    return { used: mergeUsageCount(rows, record.usage, period), period };
  }

  /** Call once after an invoice was successfully created (the new row is already counted by SQLite). */
  async recordCreated(): Promise<void> {
    const record = await this.cache.read();
    const period = getUsagePeriod(this.usageNow(record));
    const rows = await this.invoices.countCreatedBetween(period.startMs, period.endMs);
    await this.cache.update((current) => ({
      ...current,
      clockHighWaterMs: Math.max(current.clockHighWaterMs, this.now()),
      usage: nextUsageLedger(current.usage, period, rows),
    }));
  }
}
