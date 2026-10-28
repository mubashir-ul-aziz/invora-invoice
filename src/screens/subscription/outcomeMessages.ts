import type {
  CustomerCenterOutcome,
  PaywallOutcome,
  PurchaseOutcome,
  RestoreOutcome,
} from '@/data/subscription/SubscriptionService';
import { describeSubscriptionStatus } from '@/domain/subscription/entitlementMapping';
import { formatDate } from '@/domain/subscription/formatting';
import { PLAN_CONFIG } from '@/domain/subscription/plans';
import type { NormalizedSubscription } from '@/domain/subscription/types';
import type { ToastType } from '@/state/toastStore';

export interface OutcomeMessage {
  title: string;
  message: string;
  /** How the toast reporting this outcome renders: confirmed results are `success`, anything that didn't happen is `error`. */
  type: ToastType;
}

/**
 * "Subscriptions aren't available…" plus, in development builds only, the
 * developer-facing reason (e.g. "No RevenueCat key in this bundle…") so a
 * misconfigured dev build says exactly what to fix. Reasons never contain a
 * full API key (see `revenueCatConfig.ts`).
 */
function unavailableMessage(reason: string | null | undefined): string {
  const base = "Subscriptions can't be purchased in this version of the app.";
  return __DEV__ && reason ? `${base}

[Development] ${reason}` : base;
}

/**
 * User-facing wording for every purchase outcome, in one place. Success
 * wording is used ONLY for `status: 'success'` — which `SubscriptionService`
 * returns only after RevenueCat confirmed an active entitlement — so the app
 * can never say "payment successful" on the strength of a store call alone.
 * Returns `null` when nothing should be shown (the user just dismissed the
 * Google Play sheet).
 */
export function purchaseOutcomeMessage(outcome: PurchaseOutcome, planLabel: string): OutcomeMessage | null {
  switch (outcome.status) {
    case 'success':
      return { type: 'success', title: `${planLabel} is active`, message: `Your ${planLabel} plan is confirmed and unlocked. Thank you!` };
    case 'scheduled':
      return {
        title: 'Plan change scheduled',
        type: 'info',
        message: `Your switch to ${planLabel} starts at your next renewal. You keep your current plan until then.`,
      };
    case 'test_store_overlap': {
      const currentLabel = PLAN_CONFIG[outcome.snapshot.plan].label;
      return {
        title: `${planLabel} purchased (Test Store)`,
        type: 'success',
        message:
          `RevenueCat confirmed ${planLabel}, but the RevenueCat Test Store can't replace your existing ` +
          `${currentLabel} test subscription. You keep ${currentLabel} until that test subscription ends, then ${planLabel} applies. ` +
          'On Google Play this change is scheduled for your next renewal instead.',
      };
    }
    case 'pending':
      return {
        title: 'Waiting for Google Play',
        type: 'info',
        message: `Google Play hasn't confirmed this payment yet, so ${planLabel} is not unlocked. It will unlock automatically once the payment is confirmed.`,
      };
    case 'cancelled':
      return null;
    case 'already_subscribed':
      return { type: 'info', title: 'Already subscribed', message: `You already have ${planLabel}.` };
    case 'network_error':
      return { type: 'error', title: 'No connection', message: 'Connect to the internet to upgrade. You have not been charged.' };
    case 'store_unavailable':
      return { type: 'error', title: 'Google Play unavailable', message: "Google Play couldn't be reached. Please try again in a moment." };
    case 'product_unavailable':
      return {
        title: 'Plan unavailable',
        type: 'error',
        message: `${planLabel} couldn't be loaded from the store right now, so it can't be purchased yet. Please try again later. You have not been charged.`,
      };
    case 'unavailable':
      return { type: 'error', title: 'Purchases unavailable', message: unavailableMessage(outcome.reason) };
    case 'failed':
      return { type: 'error', title: 'Purchase failed', message: outcome.message };
  }
}

export function restoreOutcomeMessage(outcome: RestoreOutcome): OutcomeMessage {
  switch (outcome.status) {
    case 'restored': {
      const label = PLAN_CONFIG[outcome.snapshot.subscription.plan].label;
      return {
        title: 'Purchases restored',
        type: 'success',
        message: `Your ${label} subscription was found and restored. Your invoice limit has been updated.`,
      };
    }
    case 'already_active':
      return { type: 'info', title: 'Already active', message: 'Your subscription is already active on this device.' };
    case 'nothing_to_restore':
      return {
        title: 'Nothing to restore',
        type: 'info',
        message: 'No active Metriqo subscription was found for this store account.',
      };
    case 'network_error':
      return { type: 'error', title: 'No connection', message: 'Connect to the internet to restore your purchases, then try again.' };
    case 'store_unavailable':
      return { type: 'error', title: 'Store unavailable', message: "The store couldn't be reached. Please try again in a moment." };
    case 'unavailable':
      return { type: 'error', title: 'Restore unavailable', message: unavailableMessage(outcome.reason) };
    case 'failed':
      return { type: 'error', title: 'Restore failed', message: outcome.message };
  }
}

/**
 * Wording for the RevenueCat-hosted Paywall's result. `null` when nothing
 * should be shown — the user just dismissed it, or it had nothing to offer.
 */
export function paywallOutcomeMessage(outcome: PaywallOutcome): OutcomeMessage | null {
  switch (outcome.status) {
    case 'purchased': {
      const label = PLAN_CONFIG[outcome.snapshot.plan].label;
      return { type: 'success', title: `${label} is active`, message: `Your ${label} plan is confirmed and unlocked. Thank you!` };
    }
    case 'restored':
      return { type: 'success', title: 'Purchases restored', message: 'Your subscription was found and restored.' };
    case 'cancelled':
    case 'not_presented':
      return null;
    case 'unavailable':
      return { type: 'error', title: 'Purchases unavailable', message: "Subscriptions aren't available in this version of the app." };
    case 'failed':
      return { type: 'error', title: 'Purchase failed', message: outcome.message };
  }
}

/** Wording for Customer Center's result. `null` when nothing should be shown (it closed normally). */
export function customerCenterOutcomeMessage(outcome: CustomerCenterOutcome): OutcomeMessage | null {
  switch (outcome.status) {
    case 'shown':
      return null;
    case 'unavailable':
      return { type: 'error', title: 'Not available', message: "Customer support tools aren't available in this version of the app." };
    case 'failed':
      return { type: 'error', title: "Couldn't open support options", message: outcome.message };
  }
}

/**
 * Wording for a cancellation (or an undone cancellation) that RevenueCat
 * reports for the same paid plan — the only confirmation Metriqo gets, since
 * cancelling itself happens in Google Play / Customer Center. `null` for
 * every other change (startup cache loads, purchases, expiries), which are
 * either reported by their own flow or not an action result at all.
 */
export function planStatusChangeMessage(
  previous: NormalizedSubscription,
  next: NormalizedSubscription,
): OutcomeMessage | null {
  if (previous.plan !== next.plan || !next.isActive) {
    return null;
  }
  const before = describeSubscriptionStatus(previous);
  const after = describeSubscriptionStatus(next);
  const label = PLAN_CONFIG[next.plan].label;
  if (before === 'ACTIVE' && after === 'CANCELLED_BUT_ACTIVE') {
    const until = next.expiresAt !== null ? `until ${formatDate(next.expiresAt)}` : 'until the end of your billing period';
    return {
      type: 'success',
      title: `${label} plan cancelled`,
      message: `You keep ${label} ${until}, then Metriqo switches to Free.`,
    };
  }
  if (before === 'CANCELLED_BUT_ACTIVE' && after === 'ACTIVE') {
    return { type: 'success', title: `${label} plan resumed`, message: `Your ${label} plan will renew as usual.` };
  }
  return null;
}
