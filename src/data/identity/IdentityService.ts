import type { UserIdentity } from '@/domain/identity/types';

import type { UserIdentityRepository } from './UserIdentityRepository';

/**
 * Establishes Invora's own stable account identity on first use — a guest
 * user, created without any sign-in prompt, per the "install → business
 * setup → create invoice" onboarding requirement. `generateId` is injected
 * (rather than defaulted to `expo-crypto`'s `randomUUID`) so this class stays
 * importable in Jest without a native module; the real generator is wired in
 * `data/container.ts`.
 */
export class IdentityService {
  constructor(
    private readonly repository: UserIdentityRepository,
    private readonly generateId: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Idempotent: returns the existing identity if one was already created, otherwise creates a guest identity and persists it. */
  async getOrCreateLocalUserId(): Promise<UserIdentity> {
    const existing = await this.repository.read();
    if (existing) {
      return existing;
    }
    const timestamp = this.now();
    const identity: UserIdentity = {
      localUserId: this.generateId(),
      googleUserId: null,
      email: null,
      displayName: null,
      authProvider: 'local',
      accountType: 'guest',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.write(identity);
    return identity;
  }
}
