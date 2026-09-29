import { eq } from 'drizzle-orm';

import type { AccountType, AuthProvider, UserIdentity } from '@/domain/identity/types';

import { getDatabase, getDrizzle } from '../db/client';
import { userIdentity } from '../db/schema';
import type { UserIdentityRepository } from './UserIdentityRepository';

/** Singleton-per-device row, same `id = 'default'` convention as `business`/`app_settings`/`subscription_state`. */
const USER_IDENTITY_ID = 'default';

function toIdentity(row: typeof userIdentity.$inferSelect): UserIdentity {
  return {
    localUserId: row.localUserId,
    googleUserId: row.googleUserId,
    email: row.email,
    displayName: row.displayName,
    authProvider: row.authProvider as AuthProvider,
    accountType: row.accountType as AccountType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Real storage for the Invora account identity. No Jest coverage — Jest
 * can't drive the native SQLite module without a device, same as every other
 * `Sqlite*` repository in this codebase; the logic that consumes it
 * (`IdentityService`) is tested against `InMemoryUserIdentityRepository`.
 */
export class SqliteUserIdentityRepository implements UserIdentityRepository {
  async read(): Promise<UserIdentity | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(userIdentity).where(eq(userIdentity.id, USER_IDENTITY_ID));
    const row = rows[0];
    return row ? toIdentity(row) : null;
  }

  async write(identity: UserIdentity): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    const values = {
      id: USER_IDENTITY_ID,
      localUserId: identity.localUserId,
      googleUserId: identity.googleUserId,
      email: identity.email,
      displayName: identity.displayName,
      authProvider: identity.authProvider,
      accountType: identity.accountType,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    };
    await db.insert(userIdentity).values(values).onConflictDoUpdate({ target: userIdentity.id, set: values });
  }
}
