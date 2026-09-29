import type { UserIdentity } from '@/domain/identity/types';

/**
 * The singleton-per-device `user_identity` row. `read()` returns null only
 * before the very first `IdentityService.getOrCreateLocalUserId()` call ever
 * completes (fresh install, DB not yet written to); from then on a row always
 * exists and `write()` only ever updates it in place.
 */
export interface UserIdentityRepository {
  read(): Promise<UserIdentity | null>;
  write(identity: UserIdentity): Promise<void>;
}
