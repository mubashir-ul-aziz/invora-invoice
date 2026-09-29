import type { UserIdentity } from '@/domain/identity/types';

import type { UserIdentityRepository } from './UserIdentityRepository';

/** Test/preview repository — mirrors `SqliteUserIdentityRepository`'s single-row semantics. */
export class InMemoryUserIdentityRepository implements UserIdentityRepository {
  private stored: UserIdentity | null;

  constructor(seed: UserIdentity | null = null) {
    this.stored = seed;
  }

  async read(): Promise<UserIdentity | null> {
    return this.stored;
  }

  async write(identity: UserIdentity): Promise<void> {
    this.stored = identity;
  }
}
