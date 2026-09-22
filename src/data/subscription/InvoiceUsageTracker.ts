import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import { getUsagePeriod, mergeUsageCount, nextUsageLedger, type UsagePeriod } from '@/domain/subscription/invoiceAccess';
import { effectiveNow } from '@/domain/subscription/offlinePolicy';

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

  private periodFor(clockHighWaterMs: number): UsagePeriod {
    return getUsagePeriod(effectiveNow(this.now(), clockHighWaterMs));
  }

  async getUsage(): Promise<InvoiceUsageReading> {
    const record = await this.cache.read();
    const period = this.periodFor(record.clockHighWaterMs);
    const rows = await this.invoices.countCreatedBetween(period.startMs, period.endMs);
    return { used: mergeUsageCount(rows, record.usage, period), period };
  }

  /** Call once after an invoice was successfully created (the new row is already counted by SQLite). */
  async recordCreated(): Promise<void> {
    const { clockHighWaterMs } = await this.cache.read();
    const period = this.periodFor(clockHighWaterMs);
    const rows = await this.invoices.countCreatedBetween(period.startMs, period.endMs);
    await this.cache.update((current) => ({
      ...current,
      clockHighWaterMs: Math.max(current.clockHighWaterMs, this.now()),
      usage: nextUsageLedger(current.usage, period, rows),
    }));
  }
}
