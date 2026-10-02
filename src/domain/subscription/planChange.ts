import { planRank, type BillingPeriod, type PaidPlanId, type PlanId } from './plans';

export interface CurrentPlanRef {
  plan: PlanId;
  period: BillingPeriod | null;
}

/**
 * The slice of a RevenueCat `StorePackage` this needs — declared structurally
 * (like `entitlementMapping.ts`'s `EntitlementInfoLike`) so the domain layer
 * doesn't depend on the data layer's adapter types. A real `StorePackage`
 * satisfies this as-is.
 */
export interface PlanPriceRef {
  plan: PaidPlanId;
  period: BillingPeriod;
  priceMicros: number;
}

/** Real store prices for the two sides of a plan change, when RevenueCat's offerings are loaded. Either side may be missing (offerings not loaded, or that particular plan/period not offered) — `planChangeKind` then ranks the change by tier instead. */
export interface PlanChangePrices {
  current?: PlanPriceRef | null;
  target?: PlanPriceRef | null;
}

/**
 * How Google Play should apply a switch between two subscriptions/base plans:
 *  - `new`: the user has no paid plan — an ordinary first purchase.
 *  - `same`: the user is already on exactly this plan and period.
 *  - `immediate`: the new plan starts now (time-prorated credit for what's left of the old one).
 *  - `deferred`: the current plan keeps running to the end of its paid period and the new one starts at renewal.
 */
export type PlanChangeKind = 'new' | 'same' | 'immediate' | 'deferred';

/**
 * What the user is asking for, independent of how a store applies it:
 * a first purchase, the plan they already have, a different tier, or the
 * same tier on the other billing period.
 */
export type PlanChangeType = 'new' | 'same' | 'upgrade' | 'downgrade' | 'billing_period_change';

export function planChangeType(current: CurrentPlanRef, target: { plan: PaidPlanId; period: BillingPeriod }): PlanChangeType {
  if (current.plan === 'free') return 'new';
  if (current.plan === target.plan) return current.period === target.period ? 'same' : 'billing_period_change';
  return planRank(target.plan) > planRank(current.plan) ? 'upgrade' : 'downgrade';
}

/**
 * The subscription id part of a store product id: Google Play products come
 * back from RevenueCat as `<subscriptionId>:<basePlanId>`, and a product
 * change must name the subscription id alone.
 */
export function subscriptionIdOf(productId: string): string {
  return productId.split(':')[0];
}

const PERIOD_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };

/**
 * Price per day of a real store package — how Google Play ranks a change as
 * an upgrade vs a downgrade. Null when no matching package (from the
 * RevenueCat Offering) is known: Metriqo keeps no local prices to guess with.
 */
export function dayRate(plan: PaidPlanId, period: BillingPeriod, pkg?: PlanPriceRef | null): number | null {
  if (!pkg || pkg.plan !== plan || pkg.period !== period) return null;
  return pkg.priceMicros / PERIOD_DAYS[period];
}

/**
 * Decides how a plan switch is applied. Google Play treats a change as an
 * upgrade only when the new price-per-day is higher; everything else (a
 * cheaper tier, or the same tier moving monthly → yearly, which lowers the
 * day rate) takes effect at the next renewal, so the user is never charged
 * for a period they've already paid for. When the current billing period is
 * unknown the change is deferred — the safe choice.
 *
 * `prices` supplies the real store packages for both sides; when either is
 * missing the change is ranked by tier alone (a higher tier is an upgrade,
 * anything else waits for renewal). Purchasing always requires the loaded
 * Offering, so that fallback only ever affects a button label.
 */
export function planChangeKind(
  current: CurrentPlanRef,
  target: { plan: PaidPlanId; period: BillingPeriod },
  prices?: PlanChangePrices,
): PlanChangeKind {
  if (current.plan === 'free') return 'new';
  if (current.plan === target.plan && current.period === target.period) return 'same';
  if (current.period === null) return 'deferred';
  const targetRate = dayRate(target.plan, target.period, prices?.target);
  const currentRate = dayRate(current.plan as PaidPlanId, current.period, prices?.current);
  if (targetRate !== null && currentRate !== null) {
    return targetRate > currentRate ? 'immediate' : 'deferred';
  }
  return planRank(target.plan) > planRank(current.plan) ? 'immediate' : 'deferred';
}
