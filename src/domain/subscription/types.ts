import type { BillingPeriod, PlanId } from './plans';

/**
 * Everything the UI may show as "the subscription state". `plan` (not this)
 * is what access decisions use — status is a description, plan is the rule.
 * `OFFLINE`/`RESTORING`/`LOADING` are transient overlays derived from what
 * the app is doing right now; the rest describe the subscription itself.
 */
export type SubscriptionStatus =
  | 'FREE'
  | 'ACTIVE'
  | 'CANCELLED_BUT_ACTIVE'
  | 'EXPIRED'
  | 'BILLING_ISSUE'
  | 'PENDING'
  | 'UNKNOWN'
  | 'OFFLINE'
  | 'RESTORING'
  | 'LOADING';

/**
 * The normalized subscription — the ONLY subscription data Invora persists.
 * Derived from a RevenueCat `CustomerInfo`, never from raw purchase data.
 *
 * A lapsed paid plan is stored as `plan: 'free', isActive: false` with the old
 * `expiresAt` kept, so the UI can still say "expired" after a restart.
 */
export interface NormalizedSubscription {
  plan: PlanId;
  isActive: boolean;
  /** Epoch ms the current paid period ends; null when never subscribed. */
  expiresAt: number | null;
  willRenew: boolean;
  billingIssue: boolean;
  billingPeriod: BillingPeriod | null;
  /** Epoch ms of the last successful RevenueCat sync; null = never synced. */
  lastSyncedAt: number | null;
  /** `'revenuecat'` = came from a verified sync; `'default'` = nothing synced yet. */
  source: 'revenuecat' | 'default';
}

export const DEFAULT_SUBSCRIPTION: NormalizedSubscription = {
  plan: 'free',
  isActive: false,
  expiresAt: null,
  willRenew: false,
  billingIssue: false,
  billingPeriod: null,
  lastSyncedAt: null,
  source: 'default',
};

/** Per-calendar-month invoice counter kept next to the subscription cache (see `invoiceAccess.ts`). */
export interface UsageLedger {
  periodKey: string;
  count: number;
}

/** What `SubscriptionCacheRepository` persists: the normalized subscription + the two anti-tamper counters. */
export interface SubscriptionCacheRecord extends NormalizedSubscription {
  /** Highest device time ever observed; access checks use `max(now, this)` so rolling the clock back gains nothing. */
  clockHighWaterMs: number;
  usage: UsageLedger | null;
}

export const EMPTY_CACHE_RECORD: SubscriptionCacheRecord = {
  ...DEFAULT_SUBSCRIPTION,
  clockHighWaterMs: 0,
  usage: null,
};

/** Why the effective plan is what it is — surfaced for diagnostics and the status banner. */
export type PlanTrust =
  /** RevenueCat confirmed it this session. */
  | 'verified'
  /** Offline / sync failed: using the last verified state, still inside the offline policy. */
  | 'cached'
  /** Cached paid state ran past its expiry + grace window. */
  | 'expired'
  /** Cache hasn't been verified for longer than the maximum offline period. */
  | 'stale'
  /** Nothing usable cached (first run, or the cache failed its integrity check). */
  | 'none';

export interface SubscriptionSnapshot {
  /** The plan every access decision uses. */
  plan: PlanId;
  status: SubscriptionStatus;
  trust: PlanTrust;
  /** The last known normalized subscription (verified or cached). */
  subscription: NormalizedSubscription;
  /** True when the latest sync attempt couldn't reach RevenueCat. */
  isOffline: boolean;
  clockHighWaterMs: number;
  /** Where "Manage subscription" should send the user; null = use the default Play subscriptions page. */
  managementUrl: string | null;
}

/** The snapshot before anything has loaded: Free, nothing trusted. */
export const INITIAL_SNAPSHOT: SubscriptionSnapshot = {
  plan: 'free',
  status: 'UNKNOWN',
  trust: 'none',
  subscription: DEFAULT_SUBSCRIPTION,
  isOffline: false,
  clockHighWaterMs: 0,
  managementUrl: null,
};
