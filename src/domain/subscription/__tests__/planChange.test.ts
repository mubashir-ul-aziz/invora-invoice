import type { BillingPeriod, PaidPlanId } from '../plans';
import { dayRate, planChangeKind } from '../planChange';

const price = (plan: PaidPlanId, period: BillingPeriod, priceMicros: number) => ({ plan, period, priceMicros });

describe('planChangeKind', () => {
  it('treats a Free user as a plain new purchase', () => {
    expect(planChangeKind({ plan: 'free', period: null }, { plan: 'pro', period: 'monthly' })).toBe('new');
  });

  it('recognises the plan the user is already on', () => {
    expect(planChangeKind({ plan: 'pro', period: 'yearly' }, { plan: 'pro', period: 'yearly' })).toBe('same');
  });

  it('without store prices, applies a higher tier immediately and defers everything else', () => {
    expect(planChangeKind({ plan: 'starter', period: 'monthly' }, { plan: 'business', period: 'monthly' })).toBe('immediate');
    expect(planChangeKind({ plan: 'business', period: 'yearly' }, { plan: 'unlimited', period: 'yearly' })).toBe('immediate');
    expect(planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'starter', period: 'monthly' })).toBe('deferred');
    expect(planChangeKind({ plan: 'business', period: 'monthly' }, { plan: 'business', period: 'yearly' })).toBe('deferred');
  });

  it('defers when the current billing period is unknown', () => {
    expect(planChangeKind({ plan: 'business', period: null }, { plan: 'pro', period: 'monthly' })).toBe('deferred');
  });

  describe('real store prices', () => {
    it('dayRate is computed only from a matching real package — there is no local price', () => {
      expect(dayRate('starter', 'monthly', price('starter', 'monthly', 50_000_000))).toBeCloseTo(50_000_000 / 30);
      expect(dayRate('starter', 'monthly')).toBeNull();
      expect(dayRate('starter', 'monthly', price('business', 'monthly', 50_000_000))).toBeNull();
    });

    it('defers monthly → yearly on the same tier (lower day rate), applies yearly → monthly immediately', () => {
      const monthly = price('business', 'monthly', 10_000_000);
      const yearly = price('business', 'yearly', 96_000_000);
      expect(
        planChangeKind(
          { plan: 'business', period: 'monthly' },
          { plan: 'business', period: 'yearly' },
          { current: monthly, target: yearly },
        ),
      ).toBe('deferred');
      expect(
        planChangeKind(
          { plan: 'business', period: 'yearly' },
          { plan: 'business', period: 'monthly' },
          { current: yearly, target: monthly },
        ),
      ).toBe('immediate');
    });

    it('ranks by real store prices, even against tier order', () => {
      // By tier, Pro → Business is a downgrade. A regionally-priced Business package that costs more per
      // day than Pro must be an upgrade, since the store bills off the real price.
      const current = price('pro', 'monthly', 15_000_000);
      const target = price('business', 'monthly', 20_000_000);
      expect(planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'business', period: 'monthly' })).toBe('deferred');
      expect(
        planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'business', period: 'monthly' }, { current, target }),
      ).toBe('immediate');
    });

    it('falls back to tier order when only one side has a real price', () => {
      const target = price('business', 'monthly', 20_000_000);
      expect(
        planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'business', period: 'monthly' }, { target }),
      ).toBe('deferred');
    });
  });
});
