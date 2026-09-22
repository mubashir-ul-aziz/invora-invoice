import { computeYearlySavings, type BillingPeriod, type PaidPlanId } from './plans';
import type { NormalizedSubscription, SubscriptionStatus } from './types';

export interface StatusDescription {
  label: string;
  /** Tone drives the pill colour on the pricing screen. */
  tone: 'neutral' | 'good' | 'warning' | 'bad';
}

const STATUS_DESCRIPTIONS: Record<SubscriptionStatus, StatusDescription> = {
  FREE: { label: 'Free plan', tone: 'neutral' },
  ACTIVE: { label: 'Active', tone: 'good' },
  CANCELLED_BUT_ACTIVE: { label: 'Cancelled — active until it ends', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'bad' },
  BILLING_ISSUE: { label: 'Billing issue', tone: 'bad' },
  PENDING: { label: 'Payment pending', tone: 'warning' },
  UNKNOWN: { label: 'Not verified yet', tone: 'neutral' },
  OFFLINE: { label: 'Offline — using saved plan', tone: 'warning' },
  RESTORING: { label: 'Restoring purchases…', tone: 'neutral' },
  LOADING: { label: 'Checking Google Play…', tone: 'neutral' },
};

export function describeStatus(status: SubscriptionStatus): StatusDescription {
  return STATUS_DESCRIPTIONS[status];
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The one-line detail under the current plan: when it renews/ends, or what's wrong. */
export function describeRenewal(subscription: NormalizedSubscription, status: SubscriptionStatus): string | null {
  const { expiresAt } = subscription;
  switch (status) {
    case 'ACTIVE':
    case 'OFFLINE':
      return expiresAt !== null && subscription.isActive ? `Renews ${formatDate(expiresAt)}` : null;
    case 'CANCELLED_BUT_ACTIVE':
      return expiresAt !== null ? `Access ends ${formatDate(expiresAt)} — it will not renew` : null;
    case 'BILLING_ISSUE':
      return 'Google Play could not collect your last payment. Update your payment method in Google Play to keep your plan.';
    case 'EXPIRED':
      return expiresAt !== null ? `Ended ${formatDate(expiresAt)}. Your invoices and customers are still saved.` : null;
    case 'PENDING':
      return "Waiting for Google Play to confirm your payment. Your plan will update as soon as it does.";
    case 'UNKNOWN':
      return 'Connect to the internet once to verify your plan.';
    default:
      return null;
  }
}

/** "3 hours ago" / "2 days ago" — for "last verified" lines while offline. */
export function formatSyncAge(lastSyncedAt: number | null, now: number): string {
  if (lastSyncedAt === null) return 'never';
  const minutes = Math.max(0, Math.floor((now - lastSyncedAt) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Formats a store price expressed in micros, in its own currency. Falls back to a plain number if Intl can't. */
export function formatMicros(micros: number, currencyCode: string): string {
  const amount = micros / 1_000_000;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

interface PricedPackage {
  plan: PaidPlanId;
  period: BillingPeriod;
  priceMicros: number;
  currencyCode: string;
}

/** "Save 20% vs paying monthly" — only when both real store prices are known and yearly is genuinely cheaper. */
export function describeYearlySavings(monthly?: PricedPackage, yearly?: PricedPackage): string | null {
  if (!monthly || !yearly || monthly.currencyCode !== yearly.currencyCode) return null;
  const savings = computeYearlySavings(monthly.priceMicros, yearly.priceMicros);
  return savings ? `Save ${savings.percent}% vs paying monthly` : null;
}

/** Effective per-month price of a yearly package, e.g. "$4.00 / month, billed yearly". */
export function describeYearlyMonthlyEquivalent(yearly: PricedPackage): string {
  return `${formatMicros(yearly.priceMicros / 12, yearly.currencyCode)} / month, billed yearly`;
}
