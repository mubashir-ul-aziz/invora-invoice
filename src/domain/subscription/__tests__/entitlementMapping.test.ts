import { describeSubscriptionStatus, normalizeCustomerInfo, type EntitlementInfoLike } from '../entitlementMapping';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

function ent(overrides: Partial<EntitlementInfoLike> = {}): EntitlementInfoLike {
  return {
    isActive: true,
    willRenew: true,
    expirationDateMillis: NOW + 10 * DAY,
    productIdentifier: 'metriqo_business',
    productPlanIdentifier: 'monthly',
    billingIssueDetectedAtMillis: null,
    ...overrides,
  };
}

describe('normalizeCustomerInfo', () => {
  it('maps an active entitlement to its plan', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { business: ent() } } }, NOW);
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

  it('picks the highest tier when several are active', () => {
    const result = normalizeCustomerInfo(
      {
        entitlements: {
          active: {
            starter: ent({ productIdentifier: 'metriqo_starter' }),
            pro: ent({ productIdentifier: 'metriqo_pro' }),
          },
        },
      },
      NOW,
    );
    expect(result.plan).toBe('pro');
  });

  it('ignores unknown entitlements — they can never grant a plan', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { unlimited_forever: ent() } } }, NOW);
    expect(result.plan).toBe('free');
    expect(result.isActive).toBe(false);
  });

  it('ignores an entitlement flagged inactive even if listed', () => {
    const result = normalizeCustomerInfo({ entitlements: { active: { pro: ent({ isActive: false }) } } }, NOW);
    expect(result.plan).toBe('free');
  });

  it('flags cancellation and billing issues without dropping access', () => {
    const cancelled = normalizeCustomerInfo({ entitlements: { active: { pro: ent({ willRenew: false }) } } }, NOW);
    expect(cancelled.isActive).toBe(true);
    expect(describeSubscriptionStatus(cancelled)).toBe('CANCELLED_BUT_ACTIVE');

    const billing = normalizeCustomerInfo(
      { entitlements: { active: { pro: ent({ billingIssueDetectedAtMillis: NOW - 1000 }) } } },
      NOW,
    );
    expect(billing.isActive).toBe(true);
    expect(billing.billingIssue).toBe(true);
    expect(describeSubscriptionStatus(billing)).toBe('BILLING_ISSUE');
  });

  it('reads the yearly period from the base plan', () => {
    const result = normalizeCustomerInfo(
      {
        entitlements: {
          active: { starter: ent({ productIdentifier: 'metriqo_starter', productPlanIdentifier: 'yearly' }) },
        },
      },
      NOW,
    );
    expect(result.billingPeriod).toBe('yearly');
  });

  it('reports a lapsed paid plan as free-but-expired, keeping the old expiry', () => {
    const expiry = NOW - 5 * DAY;
    const result = normalizeCustomerInfo(
      { entitlements: { active: {}, all: { business: ent({ isActive: false, expirationDateMillis: expiry }) } } },
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
