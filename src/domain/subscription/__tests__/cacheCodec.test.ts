import { sanitizeCacheRecord, serializeCacheRecord } from '../cacheCodec';
import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from '../types';

const record: SubscriptionCacheRecord = {
  plan: 'pro',
  isActive: true,
  expiresAt: 2_000_000_000_000,
  willRenew: true,
  billingIssue: false,
  billingPeriod: 'monthly',
  lastSyncedAt: 1_900_000_000_000,
  source: 'revenuecat',
  clockHighWaterMs: 1_900_000_000_000,
  usage: { periodKey: '2026-09', count: 3 },
};

describe('serializeCacheRecord', () => {
  it('changes when any signed field changes', () => {
    const base = serializeCacheRecord(record);
    const variants: SubscriptionCacheRecord[] = [
      { ...record, plan: 'unlimited' },
      { ...record, isActive: false },
      { ...record, expiresAt: record.expiresAt! + 1 },
      { ...record, willRenew: false },
      { ...record, billingIssue: true },
      { ...record, billingPeriod: 'yearly' },
      { ...record, lastSyncedAt: 1 },
      { ...record, source: 'default' },
      { ...record, clockHighWaterMs: 0 },
      { ...record, usage: { periodKey: '2026-09', count: 0 } },
      { ...record, usage: null },
    ];
    for (const variant of variants) {
      expect(serializeCacheRecord(variant)).not.toBe(base);
    }
  });
});

describe('sanitizeCacheRecord', () => {
  it('passes a well-formed record through', () => {
    expect(sanitizeCacheRecord(record)).toEqual(record);
  });

  it('collapses malformed records to "no cache"', () => {
    expect(sanitizeCacheRecord({ ...record, plan: 'platinum' as never })).toEqual(EMPTY_CACHE_RECORD);
    expect(sanitizeCacheRecord({ ...record, expiresAt: Number.NaN })).toEqual(EMPTY_CACHE_RECORD);
    expect(sanitizeCacheRecord({ ...record, source: 'hacked' as never })).toEqual(EMPTY_CACHE_RECORD);
  });
});
