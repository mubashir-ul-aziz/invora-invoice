import {
  REVENUECAT_ENTITLEMENT_ID,
  findPlanByProductId,
  planRank,
  type BillingPeriod,
  type PaidPlanId,
} from './plans';
import type { NormalizedSubscription, SubscriptionStatus } from './types';

/**
 * The slice of a RevenueCat `EntitlementInfo` this mapping reads. Declared
 * structurally so the domain layer never imports the SDK — the real
 * `CustomerInfo` satisfies it, and tests can hand-build one.
 */
export interface EntitlementInfoLike {
  isActive: boolean;
  willRenew: boolean;
  expirationDateMillis: number | null;
  productIdentifier: string;
  productPlanIdentifier?: string | null;
  billingIssueDetectedAtMillis?: number | null;
  /** RevenueCat's store for this entitlement: `PLAY_STORE`, `TEST_STORE`, `APP_STORE`, … */
  store?: string | null;
}

export interface CustomerInfoLike {
  entitlements: {
    active: Record<string, EntitlementInfoLike>;
    all?: Record<string, EntitlementInfoLike>;
  };
  /** RevenueCat's own link for managing the active subscription (a Play Store page on Android). */
  managementURL?: string | null;
  /**
   * When RevenueCat's server produced this CustomerInfo (epoch ms). Used as a
   * trusted time reference, and to tell a fresh answer from one the SDK
   * served out of its own cache while offline.
   */
  requestDateMillis?: number | null;
  /** Product ids of every currently active subscription (RevenueCat's `activeSubscriptions`). */
  activeSubscriptions?: readonly string[];
}

/**
 * Which tier an active `metriqo_premium` entitlement unlocks. The tier comes
 * from the product that granted it; if RevenueCat also lists other active
 * subscriptions (e.g. an upgrade still overlapping the old plan), the highest
 * recognised tier wins.
 *
 * An active entitlement whose product Metriqo doesn't recognise (a product
 * added in the dashboard but not to `PLAN_CONFIG`) resolves to the lowest
 * paid tier: RevenueCat has confirmed the user paid, so they must not be
 * treated as Free, but an unknown id can't claim more than the minimum.
 */
function resolveTier(
  entitlement: EntitlementInfoLike,
  activeSubscriptions: readonly string[],
): { plan: PaidPlanId; period: BillingPeriod | null } {
  let best: { plan: PaidPlanId; period: BillingPeriod | null } | null = findPlanByProductId(entitlement.productIdentifier);
  for (const productId of activeSubscriptions) {
    const match = findPlanByProductId(productId);
    if (match && (!best || planRank(match.plan) > planRank(best.plan))) {
      best = match;
    }
  }
  return best ?? { plan: 'starter', period: null };
}

/**
 * Maps RevenueCat's `CustomerInfo` to Metriqo's normalized subscription.
 * RevenueCat is the authority: only the `metriqo_premium` entitlement, and
 * only while RevenueCat reports it active, grants a paid plan. Any other
 * entitlement id is ignored — it can never grant anything.
 */
export function normalizeCustomerInfo(info: CustomerInfoLike, now: number): NormalizedSubscription {
  const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];

  if (entitlement?.isActive) {
    const { plan, period } = resolveTier(entitlement, info.activeSubscriptions ?? []);
    return {
      plan,
      isActive: true,
      expiresAt: entitlement.expirationDateMillis,
      willRenew: entitlement.willRenew,
      billingIssue: entitlement.billingIssueDetectedAtMillis != null,
      billingPeriod: period,
      lastSyncedAt: now,
      source: 'revenuecat',
    };
  }

  // No active entitlement. If it existed before, keep its expiry so the UI
  // can report "expired" rather than "free".
  const lapsed = info.entitlements.all?.[REVENUECAT_ENTITLEMENT_ID];

  return {
    plan: 'free',
    isActive: false,
    expiresAt: lapsed?.expirationDateMillis ?? null,
    willRenew: false,
    billingIssue: false,
    billingPeriod: null,
    lastSyncedAt: now,
    source: 'revenuecat',
  };
}

/** The descriptive (non-transient) status of a normalized subscription. */
export function describeSubscriptionStatus(subscription: NormalizedSubscription): SubscriptionStatus {
  if (!subscription.isActive) {
    return subscription.expiresAt !== null ? 'EXPIRED' : 'FREE';
  }
  if (subscription.billingIssue) return 'BILLING_ISSUE';
  if (!subscription.willRenew) return 'CANCELLED_BUT_ACTIVE';
  return 'ACTIVE';
}
