import { deriveDisplayStatus } from '../status';
import type { NormalizedSubscription } from '../types';

const base: NormalizedSubscription = {
  plan: 'pro',
  isActive: true,
  expiresAt: 2_000_000_000_000,
  willRenew: true,
  billingIssue: false,
  billingPeriod: 'yearly',
  lastSyncedAt: 1_000,
  source: 'revenuecat',
};

const derive = (over: Partial<Parameters<typeof deriveDisplayStatus>[0]> = {}) =>
  deriveDisplayStatus({
    subscription: base,
    plan: 'pro',
    trust: 'verified',
    isOffline: false,
    busy: null,
    purchasePending: false,
    ...over,
  });

describe('deriveDisplayStatus', () => {
  it('describes the subscription when nothing transient is happening', () => {
    expect(derive()).toBe('ACTIVE');
    expect(derive({ subscription: { ...base, willRenew: false } })).toBe('CANCELLED_BUT_ACTIVE');
    expect(derive({ subscription: { ...base, billingIssue: true } })).toBe('BILLING_ISSUE');
    expect(derive({ subscription: { ...base, plan: 'free', isActive: false }, plan: 'free' })).toBe('EXPIRED');
    expect(
      derive({ subscription: { ...base, plan: 'free', isActive: false, expiresAt: null }, plan: 'free' }),
    ).toBe('FREE');
  });

  it('lets transient conditions take precedence', () => {
    expect(derive({ busy: 'restoring' })).toBe('RESTORING');
    expect(derive({ busy: 'loading' })).toBe('LOADING');
    expect(derive({ purchasePending: true })).toBe('PENDING');
    expect(derive({ isOffline: true, trust: 'cached' })).toBe('OFFLINE');
  });

  it('does not call an untrusted paid state Active', () => {
    expect(derive({ trust: 'stale', plan: 'free' })).toBe('UNKNOWN');
    expect(derive({ trust: 'expired', plan: 'free' })).toBe('EXPIRED');
    expect(derive({ trust: 'none', plan: 'free' })).toBe('UNKNOWN');
  });
});
