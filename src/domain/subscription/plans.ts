/**
 * The single source of truth for every Metriqo plan rule. UI components,
 * services and stores read plan behaviour from `PLAN_CONFIG` (via the
 * access/entitlement helpers built on it) instead of branching on plan names,
 * so changing a limit is a one-line edit here.
 *
 * RevenueCat setup this mirrors:
 *  - one Offering, `metriqo_premium`, holding eight Packages
 *    (`<plan>_<period>`, e.g. `starter_monthly`);
 *  - one Entitlement, `metriqo_premium`, attached to all eight products;
 *  - one product per plan + period, `metriqo_<plan>_<period>`.
 * The entitlement says *whether* the user has paid; the product identifier on
 * it says *which* tier. Billing period never changes the monthly allowance.
 *
 * Prices: the store's localized `priceString` from the RevenueCat Offering is
 * the authoritative price whenever it has loaded. `FALLBACK_PRICES_USD` is
 * only a *display* fallback so the pricing screen still shows each plan's
 * standard price while offline or while the store can't be reached — it is
 * never used to charge anything (a purchase always needs the store package).
 *
 * Moving from the RevenueCat Test Store to Google Play only means creating
 * the same product ids in Play (RevenueCat reports a Play product as
 * `<productId>:<basePlanId>`, which `findPlanByProductId` already accepts) and
 * swapping the API key — nothing below changes.
 */

export type PlanId = 'free' | 'starter' | 'business' | 'pro' | 'unlimited';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingPeriod = 'monthly' | 'yearly';

export const PLAN_ORDER: readonly PlanId[] = ['free', 'starter', 'business', 'pro', 'unlimited'];
export const PAID_PLAN_IDS: readonly PaidPlanId[] = ['starter', 'business', 'pro', 'unlimited'];
export const BILLING_PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

/** RevenueCat Offering that holds the eight paid packages. */
export const REVENUECAT_OFFERING_ID = 'metriqo_premium';

/** The one RevenueCat entitlement every paid product unlocks. */
export const REVENUECAT_ENTITLEMENT_ID = 'metriqo_premium';

/**
 * Invoices per **calendar month** for each plan — the same number for the
 * monthly and yearly product of a tier (never multiplied by 12).
 * `Infinity` = no limit.
 */
export const PLAN_LIMITS: Readonly<Record<PlanId, number>> = {
  free: 5,
  starter: 15,
  business: 40,
  pro: 100,
  unlimited: Infinity,
};

/** How long a Free user keeps access to an invoice after `invoice.createdAt`. */
export const FREE_INVOICE_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Standard USD list prices, shown only when the store price can't be loaded
 * (offline, RevenueCat unreachable). Keep in sync with the products' prices in
 * RevenueCat / Google Play — the store price always wins once it loads.
 */
export const FALLBACK_PRICES_USD: Readonly<Record<PaidPlanId, Record<BillingPeriod, number>>> = {
  starter: { monthly: 5, yearly: 48 },
  business: { monthly: 10, yearly: 96 },
  pro: { monthly: 15, yearly: 144 },
  unlimited: { monthly: 20, yearly: 192 },
};

/** "$5" / "$4.50" — the fallback display price for a plan + period. */
export function formatFallbackPrice(plan: PaidPlanId, period: BillingPeriod): string {
  const usd = FALLBACK_PRICES_USD[plan][period];
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

export interface PlanProduct {
  /** Store / RevenueCat product identifier, e.g. `metriqo_starter_monthly`. */
  productId: string;
  /** Package identifier inside the RevenueCat Offering, e.g. `starter_monthly`. */
  packageId: string;
}

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Short line under the plan name on the pricing screen. */
  tagline: string;
  /** `null` = unlimited. Derived from `PLAN_LIMITS`. */
  monthlyInvoiceLimit: number | null;
  badge: string | null;
  historicalInvoiceAccess: boolean;
  historicalCustomerAccess: boolean;
  /** `'all'` today — every plan can use every invoice pricing method. */
  allowedPricingMethods: 'all' | readonly string[];
  products: Record<BillingPeriod, PlanProduct> | null;
}

function paidProducts(plan: PaidPlanId): Record<BillingPeriod, PlanProduct> {
  return {
    monthly: { productId: `metriqo_${plan}_monthly`, packageId: `${plan}_monthly` },
    yearly: { productId: `metriqo_${plan}_yearly`, packageId: `${plan}_yearly` },
  };
}

function limitOf(plan: PlanId): number | null {
  const limit = PLAN_LIMITS[plan];
  return Number.isFinite(limit) ? limit : null;
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Free',
    tagline: 'Get started',
    monthlyInvoiceLimit: limitOf('free'),
    badge: null,
    historicalInvoiceAccess: false,
    historicalCustomerAccess: false,
    allowedPricingMethods: 'all',
    products: null,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    tagline: 'For freelancers',
    monthlyInvoiceLimit: limitOf('starter'),
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    products: paidProducts('starter'),
  },
  business: {
    id: 'business',
    label: 'Business',
    tagline: 'Growing operations',
    monthlyInvoiceLimit: limitOf('business'),
    badge: 'MOST POPULAR',
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    products: paidProducts('business'),
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    tagline: 'Established teams',
    monthlyInvoiceLimit: limitOf('pro'),
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
    products: paidProducts('pro'),
  },
  unlimited: {
    id: 'unlimited',
    label: 'Unlimited',
    tagline: 'Maximum scale',
    monthlyInvoiceLimit: limitOf('unlimited'),
    badge: null,
    historicalInvoiceAccess: true,
    historicalCustomerAccess: true,
    allowedPricingMethods: 'all',
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

/**
 * Resolves a RevenueCat product identifier (`metriqo_pro_yearly`) back to its
 * plan + period. Google Play products arrive as `<productId>:<basePlanId>`;
 * the base-plan suffix is ignored, so the same table serves the Test Store
 * and Play. Unknown ids resolve to null and can never become a plan.
 */
export function findPlanByProductId(productIdentifier: string): { plan: PaidPlanId; period: BillingPeriod } | null {
  const productId = productIdentifier.split(':')[0];
  for (const plan of PAID_PLAN_IDS) {
    const products = PLAN_CONFIG[plan].products;
    if (!products) continue;
    for (const period of BILLING_PERIODS) {
      if (products[period].productId === productId) {
        return { plan, period };
      }
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
