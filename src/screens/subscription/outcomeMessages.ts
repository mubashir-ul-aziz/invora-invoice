import type {
  CustomerCenterOutcome,
  PaywallOutcome,
  PurchaseOutcome,
  RestoreOutcome,
} from '@/data/subscription/SubscriptionService';
import { PLAN_CONFIG } from '@/domain/subscription/plans';

export interface OutcomeMessage {
  title: string;
  message: string;
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
      return { title: `${planLabel} is active`, message: `Your ${planLabel} plan is confirmed and unlocked. Thank you!` };
    case 'scheduled':
      return {
        title: 'Plan change scheduled',
        message: `Your switch to ${planLabel} starts at your next renewal. You keep your current plan until then.`,
      };
    case 'pending':
      return {
        title: 'Waiting for Google Play',
        message: `Google Play hasn't confirmed this payment yet, so ${planLabel} is not unlocked. It will unlock automatically once the payment is confirmed.`,
      };
    case 'cancelled':
      return null;
    case 'already_subscribed':
      return { title: 'Already subscribed', message: `You already have ${planLabel}.` };
    case 'network_error':
      return { title: 'No connection', message: 'Connect to the internet and try again. You have not been charged.' };
    case 'store_unavailable':
      return { title: 'Google Play unavailable', message: "Google Play couldn't be reached. Please try again in a moment." };
    case 'product_unavailable':
      return { title: 'Plan unavailable', message: "This plan isn't available right now. Please try again later." };
    case 'unavailable':
      return { title: 'Purchases unavailable', message: "Subscriptions aren't available in this version of the app." };
    case 'failed':
      return { title: 'Purchase failed', message: outcome.message };
  }
}

export function restoreOutcomeMessage(outcome: RestoreOutcome): OutcomeMessage {
  switch (outcome.status) {
    case 'restored':
      return { title: 'Purchases restored', message: 'Your subscription was found and restored.' };
    case 'already_active':
      return { title: 'Already active', message: 'Your subscription is already active on this device.' };
    case 'nothing_to_restore':
      return {
        title: 'Nothing to restore',
        message: 'No active subscription was found for this Google account.',
      };
    case 'network_error':
      return { title: 'No connection', message: 'Connect to the internet and try again.' };
    case 'store_unavailable':
      return { title: 'Google Play unavailable', message: "Google Play couldn't be reached. Please try again in a moment." };
    case 'unavailable':
      return { title: 'Restore unavailable', message: "Subscriptions aren't available in this version of the app." };
    case 'failed':
      return { title: 'Restore failed', message: outcome.message };
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
      return { title: `${label} is active`, message: `Your ${label} plan is confirmed and unlocked. Thank you!` };
    }
    case 'restored':
      return { title: 'Purchases restored', message: 'Your subscription was found and restored.' };
    case 'cancelled':
    case 'not_presented':
      return null;
    case 'unavailable':
      return { title: 'Purchases unavailable', message: "Subscriptions aren't available in this version of the app." };
    case 'failed':
      return { title: 'Purchase failed', message: outcome.message };
  }
}

/** Wording for Customer Center's result. `null` when nothing should be shown (it closed normally). */
export function customerCenterOutcomeMessage(outcome: CustomerCenterOutcome): OutcomeMessage | null {
  switch (outcome.status) {
    case 'shown':
      return null;
    case 'unavailable':
      return { title: 'Not available', message: "Customer support tools aren't available in this version of the app." };
    case 'failed':
      return { title: "Couldn't open support options", message: outcome.message };
  }
}
