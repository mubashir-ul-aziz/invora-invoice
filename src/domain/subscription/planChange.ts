import { PLAN_CONFIG, type BillingPeriod, type PaidPlanId, type PlanId } from './plans';

export interface CurrentPlanRef {
  plan: PlanId;
  period: BillingPeriod | null;
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

/** Price per day at the reference USD prices — how Google Play ranks a change as an upgrade vs a downgrade. */
export function dayRate(plan: PaidPlanId, period: BillingPeriod): number {
  return PLAN_CONFIG[plan].fallbackPriceUsd[period] / PERIOD_DAYS[period];
}

/**
 * Decides how a plan switch is applied. Google Play treats a change as an
 * upgrade only when the new price-per-day is higher; everything else (a
 * cheaper tier, or the same tier moving monthly → yearly, which lowers the
 * day rate) takes effect at the next renewal, so the user is never charged
 * for a period they've already paid for. When the current billing period is
 * unknown the change is deferred — the safe choice.
 */
export function planChangeKind(
  current: CurrentPlanRef,
  target: { plan: PaidPlanId; period: BillingPeriod },
): PlanChangeKind {
  if (current.plan === 'free') return 'new';
  if (current.plan === target.plan && current.period === target.period) return 'same';
  if (current.period === null) return 'deferred';
  return dayRate(target.plan, target.period) > dayRate(current.plan as PaidPlanId, current.period)
    ? 'immediate'
    : 'deferred';
}
