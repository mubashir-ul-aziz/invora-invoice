import { DEFAULT_SUBSCRIPTION, type NormalizedSubscription } from '@/domain/subscription/types';

import { planStatusChangeMessage } from '../outcomeMessages';

const expiresAt = new Date(2026, 10, 12).getTime();

function sub(overrides: Partial<NormalizedSubscription>): NormalizedSubscription {
  return {
    ...DEFAULT_SUBSCRIPTION,
    plan: 'pro',
    isActive: true,
    expiresAt,
    willRenew: true,
    billingPeriod: 'monthly',
    source: 'revenuecat',
    ...overrides,
  };
}

describe('planStatusChangeMessage', () => {
  it('confirms a cancellation reported for the same plan, with the date it ends', () => {
    const message = planStatusChangeMessage(sub({}), sub({ willRenew: false }));

    expect(message).toEqual(
      expect.objectContaining({ type: 'success', title: 'Pro plan cancelled', message: expect.stringContaining('You keep Pro until') }),
    );
    expect(message!.message).toContain(
      new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    );
  });

  it('confirms an undone cancellation', () => {
    expect(planStatusChangeMessage(sub({ willRenew: false }), sub({}))).toEqual(
      expect.objectContaining({ type: 'success', title: 'Pro plan resumed' }),
    );
  });

  it('says nothing for the startup load from the default (free) subscription', () => {
    expect(planStatusChangeMessage(DEFAULT_SUBSCRIPTION, sub({ willRenew: false }))).toBeNull();
    expect(planStatusChangeMessage(DEFAULT_SUBSCRIPTION, sub({}))).toBeNull();
  });

  it('says nothing for plan changes, expiries or unchanged syncs', () => {
    expect(planStatusChangeMessage(sub({ plan: 'business' }), sub({ willRenew: false }))).toBeNull();
    expect(planStatusChangeMessage(sub({ willRenew: false }), sub({ plan: 'free', isActive: false }))).toBeNull();
    expect(planStatusChangeMessage(sub({}), sub({ lastSyncedAt: 123 }))).toBeNull();
  });
});
