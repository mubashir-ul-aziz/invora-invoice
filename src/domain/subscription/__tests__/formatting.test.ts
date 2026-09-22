import {
  describeRenewal,
  describeStatus,
  describeYearlyMonthlyEquivalent,
  describeYearlySavings,
  formatSyncAge,
} from '../formatting';
import type { NormalizedSubscription, SubscriptionStatus } from '../types';

const sub: NormalizedSubscription = {
  plan: 'pro',
  isActive: true,
  expiresAt: new Date(2026, 9, 12).getTime(),
  willRenew: true,
  billingIssue: false,
  billingPeriod: 'monthly',
  lastSyncedAt: 0,
  source: 'revenuecat',
};

describe('describeStatus', () => {
  it('has a label for every status', () => {
    const all: SubscriptionStatus[] = [
      'FREE',
      'ACTIVE',
      'CANCELLED_BUT_ACTIVE',
      'EXPIRED',
      'BILLING_ISSUE',
      'PENDING',
      'UNKNOWN',
      'OFFLINE',
      'RESTORING',
      'LOADING',
    ];
    for (const status of all) {
      expect(describeStatus(status).label.length).toBeGreaterThan(0);
    }
  });
});

describe('describeRenewal', () => {
  it('says when an active plan renews and when a cancelled one ends', () => {
    expect(describeRenewal(sub, 'ACTIVE')).toMatch(/^Renews /);
    expect(describeRenewal({ ...sub, willRenew: false }, 'CANCELLED_BUT_ACTIVE')).toMatch(/will not renew/);
  });

  it('explains billing issues, expiry and pending payments without alarming or overpromising', () => {
    expect(describeRenewal({ ...sub, billingIssue: true }, 'BILLING_ISSUE')).toMatch(/payment method/);
    expect(describeRenewal({ ...sub, plan: 'free', isActive: false }, 'EXPIRED')).toMatch(/still saved/);
    expect(describeRenewal(sub, 'PENDING')).toMatch(/confirm/);
  });

  it('says nothing for a plain Free plan', () => {
    expect(describeRenewal({ ...sub, plan: 'free', isActive: false, expiresAt: null }, 'FREE')).toBeNull();
  });
});

describe('formatSyncAge', () => {
  it('reports how stale the last sync is', () => {
    const now = 10_000_000_000;
    expect(formatSyncAge(null, now)).toBe('never');
    expect(formatSyncAge(now - 30_000, now)).toBe('just now');
    expect(formatSyncAge(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatSyncAge(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatSyncAge(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });
});

describe('yearly pricing copy', () => {
  const monthly = { plan: 'starter' as const, period: 'monthly' as const, priceMicros: 5_000_000, currencyCode: 'USD' };
  const yearly = { plan: 'starter' as const, period: 'yearly' as const, priceMicros: 48_000_000, currencyCode: 'USD' };

  it('states a saving only when the real prices support it', () => {
    expect(describeYearlySavings(monthly, yearly)).toBe('Save 20% vs paying monthly');
    expect(describeYearlySavings(monthly, { ...yearly, priceMicros: 60_000_000 })).toBeNull();
    expect(describeYearlySavings(monthly, undefined)).toBeNull();
    expect(describeYearlySavings(monthly, { ...yearly, currencyCode: 'EUR' })).toBeNull();
  });

  it('shows the honest per-month equivalent of a yearly price', () => {
    expect(describeYearlyMonthlyEquivalent(yearly)).toContain('4.00');
    expect(describeYearlyMonthlyEquivalent(yearly)).toContain('billed yearly');
  });
});
