import { EMPTY_CACHE_RECORD, type SubscriptionCacheRecord } from '@/domain/subscription/types';

import type { SubscriptionCacheRepository } from './SubscriptionCacheRepository';

/**
 * Serializes every read-modify-write of the cache. A foreground refresh, a
 * connectivity-triggered refresh and an invoice-created counter bump can all
 * fire at once; without a single queue, one could overwrite another's change
 * (e.g. a sync erasing a just-incremented invoice counter). Everything that
 * mutates the cache goes through `update()`.
 */
export class SubscriptionCache {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repository: SubscriptionCacheRepository) {}

  /** The current record, or `EMPTY_CACHE_RECORD` when nothing (valid) is stored. */
  async read(): Promise<SubscriptionCacheRecord> {
    await this.queue.catch(() => undefined);
    return (await this.repository.get()) ?? EMPTY_CACHE_RECORD;
  }

  /** Reads the latest record, applies `mutator`, persists and returns the result — atomically with respect to other `update()` calls. */
  update(mutator: (current: SubscriptionCacheRecord) => SubscriptionCacheRecord): Promise<SubscriptionCacheRecord> {
    const run = async () => {
      const current = (await this.repository.get()) ?? EMPTY_CACHE_RECORD;
      const next = mutator(current);
      await this.repository.save(next);
      return next;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
