import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from '@/domain/subscription/types';

import { FakeSubscriptionCacheSigner, InMemoryRawSubscriptionCacheStore } from '../InMemorySubscriptionCache';
import { SignedSubscriptionCacheRepository } from '../SignedSubscriptionCacheRepository';
import { SubscriptionCache } from '../SubscriptionCache';

const record: SubscriptionCacheRecord = {
  plan: 'business',
  isActive: true,
  expiresAt: 2_000_000_000_000,
  willRenew: true,
  billingIssue: false,
  billingPeriod: 'monthly',
  lastSyncedAt: 1_900_000_000_000,
  source: 'revenuecat',
  clockHighWaterMs: 1_900_000_000_000,
  usage: { periodKey: '2026-09', count: 2 },
  revenueCatUserId: 'guest-1',
};

describe('SignedSubscriptionCacheRepository', () => {
  it('round-trips a record it signed', async () => {
    const repo = new SignedSubscriptionCacheRepository(new InMemoryRawSubscriptionCacheStore(), new FakeSubscriptionCacheSigner());
    await repo.save(record);
    expect(await repo.get()).toEqual(record);
  });

  it('returns null when nothing was ever saved', async () => {
    const repo = new SignedSubscriptionCacheRepository(new InMemoryRawSubscriptionCacheStore(), new FakeSubscriptionCacheSigner());
    expect(await repo.get()).toBeNull();
  });

  it.each([
    ['plan', { plan: 'unlimited' as const }],
    ['expiry', { expiresAt: 9_999_999_999_999 }],
    ['active flag', { isActive: false }],
    ['usage counter', { usage: { periodKey: '2026-09', count: 0 } }],
    ['clock mark', { clockHighWaterMs: 0 }],
  ])('rejects a row whose %s was edited after signing', async (_label, patch) => {
    const store = new InMemoryRawSubscriptionCacheStore();
    const repo = new SignedSubscriptionCacheRepository(store, new FakeSubscriptionCacheSigner());
    await repo.save(record);
    store.tamper(patch);
    expect(await repo.get()).toBeNull();
  });

  it('rejects an unsigned row', async () => {
    const store = new InMemoryRawSubscriptionCacheStore({ record, signature: null });
    const repo = new SignedSubscriptionCacheRepository(store, new FakeSubscriptionCacheSigner());
    expect(await repo.get()).toBeNull();
  });

  it('rejects a row signed by a different device', async () => {
    const store = new InMemoryRawSubscriptionCacheStore();
    await new SignedSubscriptionCacheRepository(store, new FakeSubscriptionCacheSigner('device-a')).save(record);
    expect(await new SignedSubscriptionCacheRepository(store, new FakeSubscriptionCacheSigner('device-b')).get()).toBeNull();
  });

  it('rejects a structurally invalid row even if the signature matches', async () => {
    const store = new InMemoryRawSubscriptionCacheStore();
    const signer = new FakeSubscriptionCacheSigner();
    const bad = { ...record, plan: 'platinum' as never };
    await store.write(bad, 'irrelevant');
    expect(await new SignedSubscriptionCacheRepository(store, signer).get()).toBeNull();
  });

  it('saves unsigned (and so is ignored on read) rather than crashing when the signer fails', async () => {
    const signer = new FakeSubscriptionCacheSigner();
    const repo = new SignedSubscriptionCacheRepository(new InMemoryRawSubscriptionCacheStore(), signer);
    signer.failing = true;
    await expect(repo.save(record)).resolves.toBeUndefined();
    signer.failing = false;
    expect(await repo.get()).toBeNull();
  });
});

describe('SubscriptionCache', () => {
  it('serializes overlapping updates so none is lost', async () => {
    const cache = new SubscriptionCache(
      new SignedSubscriptionCacheRepository(new InMemoryRawSubscriptionCacheStore(), new FakeSubscriptionCacheSigner()),
    );
    await Promise.all(
      Array.from({ length: 20 }, () =>
        cache.update((cur) => ({
          ...cur,
          usage: { periodKey: '2026-09', count: (cur.usage?.count ?? 0) + 1 },
        })),
      ),
    );
    expect((await cache.read()).usage).toEqual({ periodKey: '2026-09', count: 20 });
  });

  it('reads the empty record when nothing valid is stored', async () => {
    const cache = new SubscriptionCache(
      new SignedSubscriptionCacheRepository(new InMemoryRawSubscriptionCacheStore(), new FakeSubscriptionCacheSigner()),
    );
    expect(await cache.read()).toEqual(EMPTY_CACHE_RECORD);
  });

  it('recovers from a tampered row by replacing it on the next update', async () => {
    const store = new InMemoryRawSubscriptionCacheStore();
    const signer = new FakeSubscriptionCacheSigner();
    const cache = new SubscriptionCache(new SignedSubscriptionCacheRepository(store, signer));
    await cache.update(() => record);
    store.tamper({ plan: 'unlimited' });

    const next = await cache.update((cur) => ({ ...cur, clockHighWaterMs: 5 }));

    expect(next.plan).toBe('free'); // the forged plan was discarded, not carried forward
    expect((await cache.read()).clockHighWaterMs).toBe(5);
  });
});
