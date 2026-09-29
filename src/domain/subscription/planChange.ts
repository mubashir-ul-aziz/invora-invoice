import { PLAN_CONFIG, type BillingPeriod, type PaidPlanId, type PlanId } from './plans';

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

/** Real store prices for the two sides of a plan change, when RevenueCat's offerings are loaded. Either side may be missing (offerings not loaded, or that particular plan/period not offered) — `dayRate` falls back to the reference price for whichever side has none. */
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

const PERIOD_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };

/**
 * Price per day — how Google Play ranks a change as an upgrade vs a
 * downgrade. Uses the real store price (`pkg.priceMicros`, in the store's own
 * currency) when a matching `StorePackage` from RevenueCat/Google Play is
 * available, since `fallbackPriceUsd` is only a reference label and can drift
 * from what the store actually charges (regional pricing, promos). Falls
 * back to `fallbackPriceUsd` when offerings haven't loaded yet.
 */
export function dayRate(plan: PaidPlanId, period: BillingPeriod, pkg?: PlanPriceRef | null): number {
  const priceMicros =
    pkg && pkg.plan === plan && pkg.period === period
      ? pkg.priceMicros
      : PLAN_CONFIG[plan].fallbackPriceUsd[period] * 1_000_000;
  return priceMicros / PERIOD_DAYS[period];
}

/**
 * Decides how a plan switch is applied. Google Play treats a change as an
 * upgrade only when the new price-per-day is higher; everything else (a
 * cheaper tier, or the same tier moving monthly → yearly, which lowers the
 * day rate) takes effect at the next renewal, so the user is never charged
 * for a period they've already paid for. When the current billing period is
 * unknown the change is deferred — the safe choice. `prices` supplies the
 * real store packages for both sides when known (see `dayRate`); comparing
 * real prices matters most right at a regional/promo price boundary where
 * the reference USD price would rank the change the wrong way.
 */
export function planChangeKind(
  current: CurrentPlanRef,
  target: { plan: PaidPlanId; period: BillingPeriod },
  prices?: PlanChangePrices,
): PlanChangeKind {
  if (current.plan === 'free') return 'new';
  if (current.plan === target.plan && current.period === target.period) return 'same';
  if (current.period === null) return 'deferred';
  return dayRate(target.plan, target.period, prices?.target) >
    dayRate(current.plan as PaidPlanId, current.period, prices?.current)
    ? 'immediate'
    : 'deferred';
}
