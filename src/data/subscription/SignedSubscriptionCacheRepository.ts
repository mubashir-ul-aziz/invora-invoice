import { sanitizeCacheRecord, serializeCacheRecord } from '@/domain/subscription/cacheCodec';
import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from '@/domain/subscription/types';

import type {
  RawSubscriptionCacheStore,
  SubscriptionCacheRepository,
  SubscriptionCacheSigner,
} from './SubscriptionCacheRepository';

/**
 * Adds tamper-evidence to any raw store. A row is returned only if its
 * signature verifies; a missing, invalid or unverifiable signature (including
 * the signer itself failing) yields `null`, which callers read as "no cache" →
 * Free until the next verified RevenueCat sync. It fails *closed*: it can
 * never turn a bad row into a paid plan.
 */
export class SignedSubscriptionCacheRepository implements SubscriptionCacheRepository {
  constructor(
    private readonly store: RawSubscriptionCacheStore,
    private readonly signer: SubscriptionCacheSigner,
  ) {}

  async get(): Promise<SubscriptionCacheRecord | null> {
    let stored;
    try {
      stored = await this.store.read();
    } catch {
      return null;
    }
    if (!stored || !stored.signature) {
      return null;
    }
    const record = sanitizeCacheRecord(stored.record);
    if (record === EMPTY_CACHE_RECORD) {
      return null;
    }
    try {
      const valid = await this.signer.verify(serializeCacheRecord(record), stored.signature);
      return valid ? record : null;
    } catch {
      return null;
    }
  }

  async save(record: SubscriptionCacheRecord): Promise<void> {
    let signature: string | null = null;
    try {
      signature = await this.signer.sign(serializeCacheRecord(record));
    } catch {
      // Secure storage unavailable: persist without a signature. The row will
      // be ignored on read (fail closed) rather than trusted unsigned.
      signature = null;
    }
    await this.store.write(record, signature);
  }
}
