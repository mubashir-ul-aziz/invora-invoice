import {
  BILLING_PERIODS,
  PAID_PLAN_IDS,
  PLAN_CONFIG,
  PLAN_ORDER,
  computeYearlySavings,
  describePlanFeatures,
  findPlanByPackageId,
  findPlanByStoreProduct,
  planRank,
} from '../plans';

describe('PLAN_CONFIG', () => {
  it('encodes the published limits, prices and access rules', () => {
    expect(PLAN_CONFIG.free.monthlyInvoiceLimit).toBe(5);
    expect(PLAN_CONFIG.starter.monthlyInvoiceLimit).toBe(15);
    expect(PLAN_CONFIG.business.monthlyInvoiceLimit).toBe(40);
    expect(PLAN_CONFIG.pro.monthlyInvoiceLimit).toBe(100);
    expect(PLAN_CONFIG.unlimited.monthlyInvoiceLimit).toBeNull();

    expect(PLAN_CONFIG.starter.fallbackPriceUsd).toEqual({ monthly: 5, yearly: 48 });
    expect(PLAN_CONFIG.business.fallbackPriceUsd).toEqual({ monthly: 10, yearly: 96 });
    expect(PLAN_CONFIG.pro.fallbackPriceUsd).toEqual({ monthly: 15, yearly: 144 });
    expect(PLAN_CONFIG.unlimited.fallbackPriceUsd).toEqual({ monthly: 20, yearly: 192 });

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

  it('gives Free no store product and every paid plan monthly + yearly base plans', () => {
    expect(PLAN_CONFIG.free.products).toBeNull();
    expect(PLAN_CONFIG.free.entitlementId).toBeNull();
    for (const plan of PAID_PLAN_IDS) {
      const products = PLAN_CONFIG[plan].products!;
      expect(products.monthly.revenueCatProductId).toBe(`invora_${plan}:monthly`);
      expect(products.yearly.revenueCatProductId).toBe(`invora_${plan}:yearly`);
      expect(products.monthly.packageId).toBe(`${plan}_monthly`);
      expect(PLAN_CONFIG[plan].entitlementId).toBe(plan);
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

  it('resolves store products in both the split and combined RevenueCat forms', () => {
    expect(findPlanByStoreProduct('invora_pro', 'yearly')).toEqual({ plan: 'pro', period: 'yearly' });
    expect(findPlanByStoreProduct('invora_pro:monthly')).toEqual({ plan: 'pro', period: 'monthly' });
    expect(findPlanByStoreProduct('invora_starter', null)).toEqual({ plan: 'starter', period: null });
    expect(findPlanByStoreProduct('somebody_elses_app')).toBeNull();
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
