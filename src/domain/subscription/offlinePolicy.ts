import type { PlanId } from './plans';
import type { NormalizedSubscription, PlanTrust } from './types';

/**
 * OFFLINE POLICY (documented, safe-by-default)
 *
 * RevenueCat is the subscription authority. This policy only decides what to
 * do when it can't be reached, using the last *verified* normalized state:
 *
 *  1. A sync that succeeded this session is authoritative — including when
 *     it says "free". Nothing below applies.
 *  2. Otherwise a cached paid plan stays in force until its `expiresAt` plus
 *     `OFFLINE_GRACE_MS`. The grace covers renewals still being processed by
 *     Google Play and billing-retry periods, so a paying customer is never
 *     downgraded mid-renewal just because they're on a plane.
 *  3. Regardless of expiry, a cache that hasn't been verified for
 *     `MAX_STALE_MS` stops being trusted (a refunded/cancelled plan can't
 *     ride an offline device forever). It is restored by the next sync.
 *  4. Device time is never trusted going backwards: decisions use
 *     `max(now, clockHighWaterMs)`.
 *  5. No cache, an invalid cache, or `plan: 'free'` → Free. The default is
 *     never a paid plan; a paid plan only ever comes from RevenueCat.
 */
export const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_STALE_MS = 90 * 24 * 60 * 60 * 1000;

export interface ResolvedPlan {
  plan: PlanId;
  trust: PlanTrust;
}

/** The time access checks should use: the device clock, but never earlier than the latest time already seen. */
export function effectiveNow(now: number, clockHighWaterMs: number): number {
  return Math.max(now, clockHighWaterMs);
}

export function resolveEffectivePlan(params: {
  subscription: NormalizedSubscription | null;
  now: number;
  clockHighWaterMs: number;
  /** True only when RevenueCat answered successfully in this app session. */
  verifiedThisSession: boolean;
}): ResolvedPlan {
  const { subscription, verifiedThisSession } = params;
  const now = effectiveNow(params.now, params.clockHighWaterMs);

  if (!subscription || subscription.source !== 'revenuecat') {
    return { plan: 'free', trust: 'none' };
  }

  if (verifiedThisSession) {
    return { plan: subscription.isActive ? subscription.plan : 'free', trust: 'verified' };
  }

  if (!subscription.isActive || subscription.plan === 'free') {
    return { plan: 'free', trust: 'cached' };
  }
  if (subscription.lastSyncedAt === null) {
    return { plan: 'free', trust: 'none' };
  }
  if (now - subscription.lastSyncedAt > MAX_STALE_MS) {
    return { plan: 'free', trust: 'stale' };
  }
  if (subscription.expiresAt !== null && now > subscription.expiresAt + OFFLINE_GRACE_MS) {
    return { plan: 'free', trust: 'expired' };
  }
  return { plan: subscription.plan, trust: 'cached' };
}
