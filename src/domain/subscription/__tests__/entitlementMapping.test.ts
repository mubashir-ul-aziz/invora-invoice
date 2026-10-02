import { describeSubscriptionStatus, normalizeCustomerInfo, type EntitlementInfoLike } from '../entitlementMapping';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const PREMIUM = 'metriqo_premium';

function ent(overrides: Partial<EntitlementInfoLike> = {}): EntitlementInfoLike {
  return {
    isActive: true,
    willRenew: true,
    expirationDateMillis: NOW + 10 * DAY,
    productIdentifier: 'metriqo_business_monthly',
    billingIssueDetectedAtMillis: null,
    ...overrides,
  };
}

describe('normalizeCustomerInfo', () => {
  it('maps an active metriqo_premium entitlement to the tier of its product', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { [PREMIUM]: ent() } } }, NOW);
    expect(result).toEqual({
      plan: 'business',
      isActive: true,
      expiresAt: NOW + 10 * DAY,
      willRenew: true,
      billingIssue: false,
      billingPeriod: 'monthly',
      lastSyncedAt: NOW,
      source: 'revenuecat',
    });
  });

  it.each([
    ['metriqo_starter_monthly', 'starter', 'monthly'],
    ['metriqo_starter_yearly', 'starter', 'yearly'],
    ['metriqo_business_monthly', 'business', 'monthly'],
    ['metriqo_business_yearly', 'business', 'yearly'],
    ['metriqo_pro_monthly', 'pro', 'monthly'],
    ['metriqo_pro_yearly', 'pro', 'yearly'],
    ['metriqo_unlimited_monthly', 'unlimited', 'monthly'],
    ['metriqo_unlimited_yearly', 'unlimited', 'yearly'],
  ])('detects %s as %s (%s)', (productIdentifier, plan, period) => {
    const result = normalizeCustomerInfo({ entitlements: { active: { [PREMIUM]: ent({ productIdentifier }) } } }, NOW);
    expect(result.plan).toBe(plan);
    expect(result.billingPeriod).toBe(period);
  });

  it('picks the highest tier when several subscriptions are active', () => {
    const result = normalizeCustomerInfo(
      {
        entitlements: { active: { [PREMIUM]: ent({ productIdentifier: 'metriqo_starter_monthly' }) } },
        activeSubscriptions: ['metriqo_starter_monthly', 'metriqo_pro_yearly'],
      },
      NOW,
    );
    expect(result.plan).toBe('pro');
    expect(result.billingPeriod).toBe('yearly');
  });

  it('never lets activeSubscriptions grant a plan without the active entitlement', () => {
    const result = normalizeCustomerInfo(
      { entitlements: { active: {} }, activeSubscriptions: ['metriqo_unlimited_yearly'] },
      NOW,
    );
    expect(result.plan).toBe('free');
    expect(result.isActive).toBe(false);
  });

  it('resolves an active entitlement with an unrecognised product to the lowest paid tier', () => {
    const result = normalizeCustomerInfo(
      { entitlements: { active: { [PREMIUM]: ent({ productIdentifier: 'metriqo_mystery' }) } } },
      NOW,
    );
    expect(result.plan).toBe('starter');
    expect(result.billingPeriod).toBeNull();
  });

  it('ignores other entitlement ids — they can never grant a plan', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { unlimited: ent() } } }, NOW);
    expect(result.plan).toBe('free');
    expect(result.isActive).toBe(false);
  });

  it('ignores an entitlement flagged inactive even if listed', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { [PREMIUM]: ent({ isActive: false }) } } }, NOW);
    expect(result.plan).toBe('free');
  });

  it('flags cancellation and billing issues without dropping access', () => {
    const cancelled = normalizeCustomerInfo({ entitlements: { active: { [PREMIUM]: ent({ willRenew: false }) } } }, NOW);
    expect(cancelled.isActive).toBe(true);
    expect(describeSubscriptionStatus(cancelled)).toBe('CANCELLED_BUT_ACTIVE');

    const billing = normalizeCustomerInfo(
      { entitlements: { active: { [PREMIUM]: ent({ billingIssueDetectedAtMillis: NOW - 1000 }) } } },
      NOW,
    );
    expect(billing.isActive).toBe(true);
    expect(billing.billingIssue).toBe(true);
    expect(describeSubscriptionStatus(billing)).toBe('BILLING_ISSUE');
  });

  it('reports a lapsed paid plan as free-but-expired, keeping the old expiry', () => {
    const expiry = NOW - 5 * DAY;
    const result = normalizeCustomerInfo(
      { entitlements: { active: {}, all: { [PREMIUM]: ent({ isActive: false, expirationDateMillis: expiry }) } } },
      NOW,
    );
    expect(result.plan).toBe('free');
    expect(result.isActive).toBe(false);
    expect(result.expiresAt).toBe(expiry);
    expect(describeSubscriptionStatus(result)).toBe('EXPIRED');
  });

  it('reports a never-subscribed customer as FREE', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: {}, all: {} } }, NOW);
    expect(result.expiresAt).toBeNull();
    expect(describeSubscriptionStatus(result)).toBe('FREE');
  });
});
