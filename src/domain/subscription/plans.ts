/**
 * The single source of truth for every Invora plan rule. UI components,
 * services and stores read plan behaviour from `PLAN_CONFIG` (via the
 * access/entitlement helpers built on it) instead of branching on plan names,
 * so changing a limit or price is a one-line edit here.
 *
 * Free has no Google Play product. Each paid tier is its own Google Play
 * *subscription* with two base plans (`monthly` / `yearly`); RevenueCat
 * identifies those products as `<subscriptionId>:<basePlanId>`, e.g.
 * `invora_starter:monthly`. The `packageId`s below are the identifiers of the
 * matching Packages in the RevenueCat `default` Offering. The RevenueCat
 * entitlement ids (`starter`, `business`, `pro`, `unlimited`) must match
 * `entitlementId` below exactly.
 */

export type PlanId = 'free' | 'starter' | 'business' | 'pro' | 'unlimited';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingPeriod = 'monthly' | 'yearly';

export const PLAN_ORDER: readonly PlanId[] = ['free', 'starter', 'business', 'pro', 'unlimited'];
export const PAID_PLAN_IDS: readonly PaidPlanId[] = ['starter', 'business', 'pro', 'unlimited'];
export const BILLING_PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

/** RevenueCat Offering that holds the eight paid packages. */
export const REVENUECAT_OFFERING_ID = 'default';

/** How long a Free user keeps access to an invoice after `invoice.createdAt`. */
export const FREE_INVOICE_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface PlanProduct {
  /** Google Play subscription (product) id. */
  storeProductId: string;
  /** Google Play base plan id inside that subscription. */
  basePlanId: string;
  /** Package identifier inside the RevenueCat Offering. */
  packageId: string;
  /** How RevenueCat names the product on Android: `<subscriptionId>:<basePlanId>`. */
  revenueCatProductId: string;
}

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Short line under the plan name on the pricing screen. */
  tagline: string;
  /** `null` = unlimited. */
  monthlyInvoiceLimit: number | null;
  /**
   * Reference USD prices, used only as a fallback label while RevenueCat
   * offerings can't be loaded. The real, localised price always comes from
   * the store product when available.
   */
  fallbackPriceUsd: Record<BillingPeriod, number>;
  badge: string | null;
  historicalInvoiceAccess: boolean;
  historicalCustomerAccess: boolean;
  /** `'all'` today — every plan can use every invoice pricing method. */
  allowedPricingMethods: 'all' | readonly string[];
  /** RevenueCat entitlement id that unlocks this plan; null for Free. */
  entitlementId: string | null;
  products: Record<BillingPeriod, PlanProduct> | null;
}

function product(subscriptionId: string, period: BillingPeriod, packageId: string): PlanProduct {
  return {
    storeProductId: subscriptionId,
    basePlanId: period,
    packageId,
    revenueCatProductId: `${subscriptionId}:${period}`,
  };
}

function paidProducts(plan: PaidPlanId): Record<BillingPeriod, PlanProduct> {
  const subscriptionId = `invora_${plan}`;
  return {
    monthly: product(subscriptionId, 'monthly', `${plan}_monthly`),
    yearly: product(subscriptionId, 'yearly', `${plan}_yearly`),
  };
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Free',
    tagline: 'Get started',
    monthlyInvoiceLimit: 5,
    fallbackPriceUsd: { monthly: 0, yearly: 0 },
    badge: null,
    historicalInvoiceAccess: false,
    historicalCustomerAccess: false,
    allowedPricingMethods: 'all',
    entitlementId: null,
    products: null,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    tagline: 'For freelancers',
    monthlyInvoiceLimit: 15,
    fallbackPriceUsd: { monthly: 5, yearly: 48 },
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    entitlementId: 'starter',
    products: paidProducts('starter'),
  },
  business: {
    id: 'business',
    label: 'Business',
    tagline: 'Growing operations',
    monthlyInvoiceLimit: 40,
    fallbackPriceUsd: { monthly: 10, yearly: 96 },
    badge: 'MOST POPULAR',
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    entitlementId: 'business',
    products: paidProducts('business'),
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    tagline: 'Established teams',
    monthlyInvoiceLimit: 100,
    fallbackPriceUsd: { monthly: 15, yearly: 144 },
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    entitlementId: 'pro',
    products: paidProducts('pro'),
  },
  unlimited: {
    id: 'unlimited',
    label: 'Unlimited',
    tagline: 'Maximum scale',
    monthlyInvoiceLimit: null,
    fallbackPriceUsd: { monthly: 20, yearly: 192 },
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    entitlementId: 'unlimited',
    products: paidProducts('unlimited'),
  },
};

export function getPlanConfig(plan: PlanId): PlanConfig {
  return PLAN_CONFIG[plan];
}

export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

export function isPaidPlan(plan: PlanId): plan is PaidPlanId {
  return plan !== 'free';
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_ORDER as readonly string[]).includes(value);
}

/** Resolves a RevenueCat package identifier (`starter_monthly`) back to its plan + period. */
export function findPlanByPackageId(packageId: string): { plan: PaidPlanId; period: BillingPeriod } | null {
  for (const plan of PAID_PLAN_IDS) {
    const products = PLAN_CONFIG[plan].products;
    if (!products) continue;
    for (const period of BILLING_PERIODS) {
      if (products[period].packageId === packageId) {
        return { plan, period };
      }
    }
  }
  return null;
}

/** Resolves a Google Play product/base-plan pair (as RevenueCat reports it on an entitlement) back to its plan + period. */
export function findPlanByStoreProduct(
  storeProductId: string,
  basePlanId?: string | null,
): { plan: PaidPlanId; period: BillingPeriod | null } | null {
  // RevenueCat may report the id as `invora_starter:monthly` or split it.
  const [productPart, basePlanPart] = storeProductId.split(':');
  const basePlan = basePlanId ?? basePlanPart ?? null;
  for (const plan of PAID_PLAN_IDS) {
    const products = PLAN_CONFIG[plan].products;
    if (products && products.monthly.storeProductId === productPart) {
      const period = BILLING_PERIODS.find((p) => products[p].basePlanId === basePlan) ?? null;
      return { plan, period };
    }
  }
  return null;
}

/** Human-readable one-liner for a plan's invoice allowance, e.g. "15 invoices / month". */
export function describeInvoiceLimit(config: PlanConfig): string {
  return config.monthlyInvoiceLimit === null
    ? 'Unlimited invoices'
    : `${config.monthlyInvoiceLimit} invoices / month`;
}

/** The bullet list shown on a plan card — derived from config, never hand-written per screen. */
export function describePlanFeatures(config: PlanConfig): string[] {
  const features = [describeInvoiceLimit(config)];
  features.push(
    config.historicalInvoiceAccess
      ? 'Historical invoices'
      : 'Recent invoices only (24 hours)',
  );
  features.push(
    config.historicalCustomerAccess ? 'Historical customers' : 'Customer history locked',
  );
  features.push('Works offline');
  return features;
}

export interface YearlySavings {
  amountMicros: number;
  percent: number;
}

/**
 * How much cheaper paying yearly is than paying monthly for twelve months —
 * computed from the *actual* store prices (same currency), never hard-coded.
 * Returns null when yearly isn't actually cheaper, so no savings claim is
 * ever shown that the numbers don't back up.
 */
export function computeYearlySavings(monthlyMicros: number, yearlyMicros: number): YearlySavings | null {
  if (!(monthlyMicros > 0) || !(yearlyMicros > 0)) {
    return null;
  }
  const twelveMonths = monthlyMicros * 12;
  if (yearlyMicros >= twelveMonths) {
    return null;
  }
  const amountMicros = twelveMonths - yearlyMicros;
  return { amountMicros, percent: Math.round((amountMicros / twelveMonths) * 100) };
}
