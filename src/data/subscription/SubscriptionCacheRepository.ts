import type { SubscriptionCacheRecord } from '@/domain/subscription/types';

/**
 * The only door the subscription layer uses to reach the on-device cache.
 * `get()` returns null when there's no cache *or* when the stored row fails
 * its integrity check — callers treat both as "nothing cached", i.e. Free.
 */
export interface SubscriptionCacheRepository {
  get(): Promise<SubscriptionCacheRecord | null>;
  save(record: SubscriptionCacheRecord): Promise<void>;
}

/** A stored row plus its signature — the dumb storage half (SQLite / in-memory) that `SignedSubscriptionCacheRepository` sits on. */
export interface StoredSubscriptionCache {
  record: SubscriptionCacheRecord;
  signature: string | null;
}

export interface RawSubscriptionCacheStore {
  read(): Promise<StoredSubscriptionCache | null>;
  write(record: SubscriptionCacheRecord, signature: string | null): Promise<void>;
}

/**
 * Signs/verifies the serialized cache. The secret never leaves secure
 * storage on this device, so a row edited by hand — or copied from another
 * device or a backup — can't produce a valid signature.
 */
export interface SubscriptionCacheSigner {
  sign(payload: string): Promise<string>;
  verify(payload: string, signature: string): Promise<boolean>;
}
