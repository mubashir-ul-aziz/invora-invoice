import {
  BILLING_PERIODS,
  PAID_PLAN_IDS,
  PLAN_CONFIG,
  PLAN_ORDER,
  computeYearlySavings,
  describePlanFeatures,
  PLAN_LIMITS,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
  findPlanByPackageId,
  findPlanByProductId,
  planRank,
} from '../plans';

describe('PLAN_CONFIG', () => {
  it('encodes the published monthly limits and access rules', () => {
    expect(PLAN_LIMITS).toEqual({ free: 5, starter: 15, business: 40, pro: 100, unlimited: Infinity });
    expect(PLAN_CONFIG.free.monthlyInvoiceLimit).toBe(5);
    expect(PLAN_CONFIG.starter.monthlyInvoiceLimit).toBe(15);
    expect(PLAN_CONFIG.business.monthlyInvoiceLimit).toBe(40);
    expect(PLAN_CONFIG.pro.monthlyInvoiceLimit).toBe(100);
    expect(PLAN_CONFIG.unlimited.monthlyInvoiceLimit).toBeNull();

    expect(PLAN_CONFIG.free.historicalInvoiceAccess).toBe(false);
    expect(PLAN_CONFIG.free.historicalCustomerAccess).toBe(false);
    for (const plan of PAID_PLAN_IDS) {
      expect(PLAN_CONFIG[plan].historicalInvoiceAccess).toBe(true);
      expect(PLAN_CONFIG[plan].historicalCustomerAccess).toBe(true);
    }
  });

  it('marks only Business as MOST POPULAR', () => {
    const badged = PLAN_ORDER.filter((p) => PLAN_CONFIG[p].badge !== null);
    expect(badged).toEqual(['business']);
    expect(PLAN_CONFIG.business.badge).toBe('MOST POPULAR');
  });

  it('matches the RevenueCat Offering, Entitlement, Packages and Products', () => {
    expect(REVENUECAT_OFFERING_ID).toBe('metriqo_premium');
    expect(REVENUECAT_ENTITLEMENT_ID).toBe('metriqo_premium');
    expect(PLAN_CONFIG.free.products).toBeNull();
    for (const plan of PAID_PLAN_IDS) {
      const products = PLAN_CONFIG[plan].products!;
      expect(products.monthly).toEqual({ productId: `metriqo_${plan}_monthly`, packageId: `${plan}_monthly` });
      expect(products.yearly).toEqual({ productId: `metriqo_${plan}_yearly`, packageId: `${plan}_yearly` });
    }
  });

  it('ranks plans from Free up to Unlimited', () => {
    expect(planRank('free')).toBeLessThan(planRank('starter'));
    expect(planRank('pro')).toBeLessThan(planRank('unlimited'));
  });
});

describe('product lookup', () => {
  it('resolves every configured package id to its plan and period', () => {
    for (const plan of PAID_PLAN_IDS) {
      for (const period of BILLING_PERIODS) {
        const packageId = PLAN_CONFIG[plan].products![period].packageId;
        expect(findPlanByPackageId(packageId)).toEqual({ plan, period });
      }
    }
    expect(findPlanByPackageId('lifetime')).toBeNull();
  });

  it('maps every product id to its tier — monthly and yearly to the same tier', () => {
    expect(findPlanByProductId('metriqo_starter_monthly')).toEqual({ plan: 'starter', period: 'monthly' });
    expect(findPlanByProductId('metriqo_starter_yearly')).toEqual({ plan: 'starter', period: 'yearly' });
    expect(findPlanByProductId('metriqo_business_monthly')).toEqual({ plan: 'business', period: 'monthly' });
    expect(findPlanByProductId('metriqo_business_yearly')).toEqual({ plan: 'business', period: 'yearly' });
    expect(findPlanByProductId('metriqo_pro_monthly')).toEqual({ plan: 'pro', period: 'monthly' });
    expect(findPlanByProductId('metriqo_pro_yearly')).toEqual({ plan: 'pro', period: 'yearly' });
    expect(findPlanByProductId('metriqo_unlimited_monthly')).toEqual({ plan: 'unlimited', period: 'monthly' });
    expect(findPlanByProductId('metriqo_unlimited_yearly')).toEqual({ plan: 'unlimited', period: 'yearly' });
  });

  it('accepts the Google Play `<productId>:<basePlanId>` form and rejects unknown/old ids', () => {
    expect(findPlanByProductId('metriqo_pro_yearly:p1y')).toEqual({ plan: 'pro', period: 'yearly' });
    expect(findPlanByProductId('metriqo_pro')).toBeNull();
    expect(findPlanByProductId('metriqo_starter:monthly')).toBeNull();
    expect(findPlanByProductId('somebody_elses_app')).toBeNull();
  });
});

describe('describePlanFeatures', () => {
  it('derives the bullets from config', () => {
    expect(describePlanFeatures(PLAN_CONFIG.unlimited)).toContain('Unlimited invoices');
    expect(describePlanFeatures(PLAN_CONFIG.starter)).toContain('15 invoices / month');
    expect(describePlanFeatures(PLAN_CONFIG.free)).toContain('Recent invoices only (24 hours)');
  });
});

describe('computeYearlySavings', () => {
  it('computes real savings from the store prices', () => {
    expect(computeYearlySavings(5_000_000, 48_000_000)).toEqual({ amountMicros: 12_000_000, percent: 20 });
  });

  it('claims no savings when yearly is not actually cheaper or prices are missing', () => {
    expect(computeYearlySavings(5_000_000, 60_000_000)).toBeNull();
    expect(computeYearlySavings(5_000_000, 70_000_000)).toBeNull();
    expect(computeYearlySavings(0, 48_000_000)).toBeNull();
    expect(computeYearlySavings(5_000_000, 0)).toBeNull();
  });
});
