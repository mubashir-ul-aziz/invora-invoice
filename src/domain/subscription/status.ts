import { describeSubscriptionStatus } from './entitlementMapping';
import type { NormalizedSubscription, PlanTrust, SubscriptionStatus } from './types';

export type SubscriptionBusyState = 'loading' | 'restoring' | null;

/**
 * The single status the UI shows. Transient conditions (working, offline,
 * pending) take precedence over the stored description of the subscription.
 * None of these change `plan` — a paid user who goes offline is shown as
 * `OFFLINE` but keeps their plan under the offline policy.
 */
export function deriveDisplayStatus(params: {
  subscription: NormalizedSubscription;
  plan: string;
  trust: PlanTrust;
  isOffline: boolean;
  busy: SubscriptionBusyState;
  purchasePending: boolean;
}): SubscriptionStatus {
  const { subscription, plan, trust, isOffline, busy, purchasePending } = params;

  if (busy === 'restoring') return 'RESTORING';
  if (busy === 'loading') return 'LOADING';
  if (purchasePending) return 'PENDING';

  // A paid state we no longer trust must not read as "Active".
  if (trust === 'stale') return 'UNKNOWN';
  if (trust === 'expired') return 'EXPIRED';
  if (trust === 'none') return 'UNKNOWN';

  if (isOffline && trust === 'cached' && plan !== 'free') return 'OFFLINE';

  return describeSubscriptionStatus(subscription);
}
