import type { SubscriptionCacheRecord } from '@/domain/subscription/types';

import type {
  RawSubscriptionCacheStore,
  StoredSubscriptionCache,
  SubscriptionCacheSigner,
} from './SubscriptionCacheRepository';

/** Test/preview raw store. `tamper()` edits the "database" behind the signature's back, like a hand-edited SQLite row would. */
export class InMemoryRawSubscriptionCacheStore implements RawSubscriptionCacheStore {
  private stored: StoredSubscriptionCache | null;

  constructor(seed: StoredSubscriptionCache | null = null) {
    this.stored = seed;
  }

  async read(): Promise<StoredSubscriptionCache | null> {
    return this.stored;
  }

  async write(record: SubscriptionCacheRecord, signature: string | null): Promise<void> {
    this.stored = { record, signature };
  }

  tamper(patch: Partial<SubscriptionCacheRecord>): void {
    if (this.stored) {
      this.stored = { ...this.stored, record: { ...this.stored.record, ...patch } };
    }
  }
}

/** Deterministic signer for tests: signature = secret + payload. A different `secret` models a different device. */
export class FakeSubscriptionCacheSigner implements SubscriptionCacheSigner {
  failing = false;

  constructor(private readonly secret = 'device-secret') {}

  async sign(payload: string): Promise<string> {
    if (this.failing) throw new Error('secure storage unavailable');
    return `${this.secret}:${payload}`;
  }

  async verify(payload: string, signature: string): Promise<boolean> {
    if (this.failing) throw new Error('secure storage unavailable');
    return signature === `${this.secret}:${payload}`;
  }
}
