import { dayRate, planChangeKind } from '../planChange';

describe('planChangeKind', () => {
  it('treats a Free user as a plain new purchase', () => {
    expect(planChangeKind({ plan: 'free', period: null }, { plan: 'pro', period: 'monthly' })).toBe('new');
  });

  it('recognises the plan the user is already on', () => {
    expect(planChangeKind({ plan: 'pro', period: 'yearly' }, { plan: 'pro', period: 'yearly' })).toBe('same');
  });

  it('applies a higher tier immediately', () => {
    expect(planChangeKind({ plan: 'starter', period: 'monthly' }, { plan: 'business', period: 'monthly' })).toBe('immediate');
    expect(planChangeKind({ plan: 'business', period: 'yearly' }, { plan: 'unlimited', period: 'yearly' })).toBe('immediate');
  });

  it('defers a lower tier to the next renewal', () => {
    expect(planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'starter', period: 'monthly' })).toBe('deferred');
  });

  it('defers monthly → yearly on the same tier (lower day rate), applies yearly → monthly immediately', () => {
    expect(planChangeKind({ plan: 'business', period: 'monthly' }, { plan: 'business', period: 'yearly' })).toBe('deferred');
    expect(planChangeKind({ plan: 'business', period: 'yearly' }, { plan: 'business', period: 'monthly' })).toBe('immediate');
  });

  it('defers when the current billing period is unknown', () => {
    expect(planChangeKind({ plan: 'business', period: null }, { plan: 'pro', period: 'monthly' })).toBe('deferred');
  });

  it('ranks by price per day', () => {
    expect(dayRate('starter', 'monthly')).toBeGreaterThan(dayRate('starter', 'yearly'));
  });
});
