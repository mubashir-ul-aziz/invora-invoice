import {
  PAID_PLAN_IDS,
  PLAN_CONFIG,
  findPlanByStoreProduct,
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
}

function paidPlanForEntitlement(entitlementId: string): PaidPlanId | null {
  return PAID_PLAN_IDS.find((plan) => PLAN_CONFIG[plan].entitlementId === entitlementId) ?? null;
}

function periodOf(info: EntitlementInfoLike): BillingPeriod | null {
  return findPlanByStoreProduct(info.productIdentifier, info.productPlanIdentifier)?.period ?? null;
}

/**
 * Maps RevenueCat's `CustomerInfo` to Invora's normalized subscription.
 * RevenueCat is the authority: only entitlements RevenueCat reports as
 * active grant a plan, and when several are active (e.g. a plan change in
 * flight) the highest tier wins. Entitlement ids RevenueCat returns that
 * Invora doesn't know are ignored — they can never grant anything.
 */
export function normalizeCustomerInfo(info: CustomerInfoLike, now: number): NormalizedSubscription {
  let best: { plan: PaidPlanId; entitlement: EntitlementInfoLike } | null = null;
  for (const [entitlementId, entitlement] of Object.entries(info.entitlements.active)) {
    const plan = paidPlanForEntitlement(entitlementId);
    if (!plan || !entitlement.isActive) continue;
    if (!best || planRank(plan) > planRank(best.plan)) {
      best = { plan, entitlement };
    }
  }

  if (best) {
    const { plan, entitlement } = best;
    return {
      plan,
      isActive: true,
      expiresAt: entitlement.expirationDateMillis,
      willRenew: entitlement.willRenew,
      billingIssue: entitlement.billingIssueDetectedAtMillis != null,
      billingPeriod: periodOf(entitlement),
      lastSyncedAt: now,
      source: 'revenuecat',
    };
  }

  // No active paid entitlement. If a paid one existed before, keep its expiry
  // so the UI can report "expired" rather than "free".
  let lastExpiry: number | null = null;
  for (const [entitlementId, entitlement] of Object.entries(info.entitlements.all ?? {})) {
    if (!paidPlanForEntitlement(entitlementId)) continue;
    const expiry = entitlement.expirationDateMillis;
    if (expiry != null && (lastExpiry === null || expiry > lastExpiry)) {
      lastExpiry = expiry;
    }
  }

  return {
    plan: 'free',
    isActive: false,
    expiresAt: lastExpiry,
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
