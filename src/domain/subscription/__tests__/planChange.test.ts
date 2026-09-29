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

  describe('real store prices', () => {
    it('dayRate prefers a matching real package price over the fallback reference price', () => {
      // fallbackPriceUsd.starter.monthly is $5 — a real store price of $50/mo should win, not be ignored.
      const real = { plan: 'starter' as const, period: 'monthly' as const, priceMicros: 50_000_000 };
      expect(dayRate('starter', 'monthly', real)).toBeCloseTo(50_000_000 / 30);
      expect(dayRate('starter', 'monthly')).not.toBeCloseTo(50_000_000 / 30);
    });

    it('ignores a package for the wrong plan/period and falls back to the reference price', () => {
      const wrongPlan = { plan: 'business' as const, period: 'monthly' as const, priceMicros: 50_000_000 };
      expect(dayRate('starter', 'monthly', wrongPlan)).toBe(dayRate('starter', 'monthly'));
    });

    it('ranks by real store prices, reversing what the reference USD prices alone would say', () => {
      // Reference prices rank Business ($10/mo) below Pro ($15/mo) — an ordinary downgrade. A real,
      // regionally-priced Business package that actually costs more per day than Pro must flip that
      // to an upgrade, since Google Play bills off the real price, not Metriqo's reference label.
      const current = { plan: 'pro' as const, period: 'monthly' as const, priceMicros: 15_000_000 };
      const target = { plan: 'business' as const, period: 'monthly' as const, priceMicros: 20_000_000 };

      expect(planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'business', period: 'monthly' })).toBe(
        'deferred',
      );
      expect(
        planChangeKind(
          { plan: 'pro', period: 'monthly' },
          { plan: 'business', period: 'monthly' },
          { current, target },
        ),
      ).toBe('immediate');
    });

    it('falls back to the reference price for whichever side has no real package', () => {
      // Only the target's real price is known; the current side still uses its fallback.
      const target = { plan: 'business' as const, period: 'monthly' as const, priceMicros: 20_000_000 };
      expect(
        planChangeKind({ plan: 'pro', period: 'monthly' }, { plan: 'business', period: 'monthly' }, { target }),
      ).toBe('immediate');
    });
  });
});
