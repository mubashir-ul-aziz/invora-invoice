import { isPlanId, type BillingPeriod } from './plans';
import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from './types';

/**
 * A stable, field-ordered string of every cached field — the exact bytes the
 * integrity signature covers. Any hand edit of the SQLite row (or a row
 * copied from another device, whose SecureStore secret differs) changes it,
 * so the signature check fails and the cache is discarded.
 */
export function serializeCacheRecord(record: SubscriptionCacheRecord): string {
  return JSON.stringify([
    record.plan,
    record.isActive ? 1 : 0,
    record.expiresAt,
    record.willRenew ? 1 : 0,
    record.billingIssue ? 1 : 0,
    record.billingPeriod,
    record.lastSyncedAt,
    record.source,
    record.clockHighWaterMs,
    record.usage?.periodKey ?? null,
    record.usage?.count ?? null,
  ]);
}

function isFiniteOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/** Defensive shape check for a record read back from storage; anything malformed collapses to "no cache". */
export function sanitizeCacheRecord(candidate: SubscriptionCacheRecord): SubscriptionCacheRecord {
  const period: BillingPeriod | null =
    candidate.billingPeriod === 'monthly' || candidate.billingPeriod === 'yearly' ? candidate.billingPeriod : null;
  if (
    !isPlanId(candidate.plan) ||
    !isFiniteOrNull(candidate.expiresAt) ||
    !isFiniteOrNull(candidate.lastSyncedAt) ||
    !Number.isFinite(candidate.clockHighWaterMs) ||
    (candidate.source !== 'revenuecat' && candidate.source !== 'default')
  ) {
    return EMPTY_CACHE_RECORD;
  }
  return { ...candidate, billingPeriod: period };
}
