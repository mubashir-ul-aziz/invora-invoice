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

/** The subscription product that currently grants the user's plan, exactly as RevenueCat reports it. */
export interface ActiveProduct {
  /** RevenueCat's product id, e.g. `metriqo_starter_monthly` (Google Play may append `:<basePlanId>`). */
  productId: string;
  /** Null when the product isn't one of Metriqo's `metriqo_<plan>_<period>` ids. */
  plan: PaidPlanId | null;
  period: BillingPeriod | null;
}

/**
 * Which product the active `metriqo_premium` entitlement comes from. Starts
 * from the entitlement's own product; if RevenueCat also lists other active
 * subscriptions (e.g. an upgrade still overlapping the old plan, or two
 * RevenueCat Test Store subscriptions — the Test Store can't replace one
 * with another), the highest recognised tier wins. Null when the entitlement
 * isn't active.
 *
 * This is the one answer to "what does the user own right now" — the plan
 * shown in the app and the product a plan change replaces both come from it,
 * so they can never disagree.
 */
export function resolveActiveProduct(info: CustomerInfoLike): ActiveProduct | null {
  const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  if (!entitlement?.isActive) return null;
  let best: ActiveProduct = { productId: entitlement.productIdentifier, plan: null, period: null };
  const own = findPlanByProductId(entitlement.productIdentifier);
  if (own) best = { productId: entitlement.productIdentifier, ...own };
  for (const productId of info.activeSubscriptions ?? []) {
    const match = findPlanByProductId(productId);
    if (match && (!best.plan || planRank(match.plan) > planRank(best.plan))) {
      best = { productId, ...match };
    }
  }
  return best;
}

/**
 * Which tier an active `metriqo_premium` entitlement unlocks — the tier of
 * `resolveActiveProduct`.
 *
 * An active entitlement whose product Metriqo doesn't recognise (a product
 * added in the dashboard but not to `PLAN_CONFIG`) resolves to the lowest
 * paid tier: RevenueCat has confirmed the user paid, so they must not be
 * treated as Free, but an unknown id can't claim more than the minimum.
 */
function resolveTier(info: CustomerInfoLike): { plan: PaidPlanId; period: BillingPeriod | null } {
  const product = resolveActiveProduct(info);
  return product?.plan ? { plan: product.plan, period: product.period } : { plan: 'starter', period: null };
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
    const { plan, period } = resolveTier(info);
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
