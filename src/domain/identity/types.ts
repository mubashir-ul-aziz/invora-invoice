/** How this identity's current credentials were established. */
export type AuthProvider = 'local' | 'google';

/** `guest` = local-only, never signed in; `registered` = linked to a Google account. */
export type AccountType = 'guest' | 'registered';

/**
 * Invora's own stable account identity — see `db/schema.ts`'s doc comment on
 * `user_identity` for why `localUserId` is never RevenueCat's anonymous app
 * user id. Exactly one row exists per device/install; a guest becomes
 * `registered` in place (same `localUserId`) when they link a Google account,
 * never by creating a second row.
 */
export interface UserIdentity {
  localUserId: string;
  googleUserId: string | null;
  email: string | null;
  displayName: string | null;
  authProvider: AuthProvider;
  accountType: AccountType;
  createdAt: number;
  updatedAt: number;
}
