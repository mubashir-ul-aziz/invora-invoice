import { eq } from 'drizzle-orm';

import type { PlanId, BillingPeriod } from '@/domain/subscription/plans';
import type { SubscriptionCacheRecord } from '@/domain/subscription/types';

import { getDatabase, getDrizzle } from '../db/client';
import { subscriptionState } from '../db/schema';
import type { RawSubscriptionCacheStore, StoredSubscriptionCache } from './SubscriptionCacheRepository';

/** Singleton-per-device row, same `id = 'default'` convention as `business`/`app_settings`. */
const SUBSCRIPTION_STATE_ID = 'default';

function toStored(row: typeof subscriptionState.$inferSelect): StoredSubscriptionCache {
  const record: SubscriptionCacheRecord = {
    plan: row.plan as PlanId,
    isActive: row.isActive === 1,
    expiresAt: row.expiresAt,
    willRenew: row.willRenew === 1,
    billingIssue: row.billingIssue === 1,
    billingPeriod: row.billingPeriod as BillingPeriod | null,
    lastSyncedAt: row.lastSyncedAt,
    source: row.source as 'revenuecat' | 'default',
    clockHighWaterMs: row.clockHighWaterMs,
    usage:
      row.usagePeriodKey !== null && row.usageCount !== null
        ? { periodKey: row.usagePeriodKey, count: row.usageCount }
        : null,
    revenueCatUserId: row.revenueCatUserId,
  };
  return { record, signature: row.signature };
}

/**
 * Real storage half of the subscription cache, backed by `subscription_state`.
 * Deliberately dumb: it stores and returns whatever it's given. Trust is
 * decided one layer up by `SignedSubscriptionCacheRepository`. No Jest
 * coverage — Jest can't drive the native SQLite module without a device, same
 * as every other `Sqlite*` repository in this codebase.
 */
export class SqliteRawSubscriptionCacheStore implements RawSubscriptionCacheStore {
  async read(): Promise<StoredSubscriptionCache | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(subscriptionState).where(eq(subscriptionState.id, SUBSCRIPTION_STATE_ID));
    const row = rows[0];
    return row ? toStored(row) : null;
  }

  async write(record: SubscriptionCacheRecord, signature: string | null): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    const values = {
      id: SUBSCRIPTION_STATE_ID,
      plan: record.plan,
      isActive: record.isActive ? 1 : 0,
      expiresAt: record.expiresAt,
      willRenew: record.willRenew ? 1 : 0,
      billingIssue: record.billingIssue ? 1 : 0,
      billingPeriod: record.billingPeriod,
      lastSyncedAt: record.lastSyncedAt,
      source: record.source,
      clockHighWaterMs: record.clockHighWaterMs,
      usagePeriodKey: record.usage?.periodKey ?? null,
      usageCount: record.usage?.count ?? null,
      revenueCatUserId: record.revenueCatUserId,
      signature,
      updatedAt: Date.now(),
    };
    await db
      .insert(subscriptionState)
      .values(values)
      .onConflictDoUpdate({ target: subscriptionState.id, set: values });
  }
}
