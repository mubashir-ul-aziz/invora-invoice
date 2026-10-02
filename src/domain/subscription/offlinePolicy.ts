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
 *  2. Otherwise a cached paid plan — one RevenueCat itself verified earlier —
 *     stays in force for at most `OFFLINE_GRACE_MS` (3 days) after that
 *     verification (`lastSyncedAt`, RevenueCat's own server timestamp). After
 *     that it is `stale` and the user is on Free until the next successful
 *     sync, which restores the plan instantly. A yearly plan gets no longer
 *     offline window than a monthly one.
 *  3. Within those 3 days a cached plan also stops once its `expiresAt` plus
 *     `OFFLINE_GRACE_MS` has passed (covers a renewal Play hasn't reported yet).
 *  4. Device time is never trusted going backwards: decisions use
 *     `max(now, clockHighWaterMs)`.
 *  5. No cache, an invalid cache, or `plan: 'free'` → Free. The default is
 *     never a paid plan; a paid plan only ever comes from RevenueCat — the
 *     cache can only *extend* a verified plan by the grace, never create one.
 */
export const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

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
  if (now - subscription.lastSyncedAt > OFFLINE_GRACE_MS) {
    return { plan: 'free', trust: 'stale' };
  }
  if (subscription.expiresAt !== null && now > subscription.expiresAt + OFFLINE_GRACE_MS) {
    return { plan: 'free', trust: 'expired' };
  }
  return { plan: subscription.plan, trust: 'cached' };
}
