import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesEntitlementInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

import type { CustomerInfoLike, EntitlementInfoLike } from '@/domain/subscription/entitlementMapping';
import {
  BILLING_PERIODS,
  PAID_PLAN_IDS,
  PLAN_CONFIG,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_OFFERING_ID,
  findPlanByPackageId,
  findPlanByProductId,
  type BillingPeriod,
  type PaidPlanId,
} from '@/domain/subscription/plans';

import {
  RevenueCatError,
  type PaywallPresentationResult,
  type ProductChange,
  type RevenueCatAdapter,
  type RevenueCatErrorKind,
  type StorePackage,
} from './RevenueCatAdapter';
import { maskApiKey, type RevenueCatConfig, type RevenueCatStoreKind } from './revenueCatConfig';

type PurchasesModule = typeof import('react-native-purchases').default;
type PurchasesUIModule = typeof import('react-native-purchases-ui').default;

function mapEntitlement(entitlement: PurchasesEntitlementInfo): EntitlementInfoLike {
  return {
    isActive: entitlement.isActive,
    willRenew: entitlement.willRenew,
    expirationDateMillis: entitlement.expirationDateMillis,
    productIdentifier: entitlement.productIdentifier,
    productPlanIdentifier: entitlement.productPlanIdentifier,
    billingIssueDetectedAtMillis: entitlement.billingIssueDetectedAtMillis,
    store: entitlement.store,
  };
}

function mapEntitlements(entitlements: Record<string, PurchasesEntitlementInfo>): Record<string, EntitlementInfoLike> {
  const mapped: Record<string, EntitlementInfoLike> = {};
  for (const [id, entitlement] of Object.entries(entitlements)) {
    mapped[id] = mapEntitlement(entitlement);
  }
  return mapped;
}

/** Keeps only the fields Metriqo's mapping reads — no raw purchase data crosses this boundary. */
export function toCustomerInfoLike(info: CustomerInfo): CustomerInfoLike {
  const requestDate = Date.parse(info.requestDate);
  return {
    entitlements: {
      active: mapEntitlements(info.entitlements.active),
      all: mapEntitlements(info.entitlements.all),
    },
    managementURL: info.managementURL,
    requestDateMillis: Number.isNaN(requestDate) ? null : requestDate,
    activeSubscriptions: info.activeSubscriptions,
  };
}

/** Development-only diagnostics. Never pass a full API key here — use `maskApiKey`. */
function debugLog(message: string, details?: unknown): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[RevenueCat] ${message}`, details === undefined ? '' : details);
  }
}

interface MatchedPackage {
  plan: PaidPlanId;
  period: BillingPeriod;
  pkg: PurchasesPackage;
}

/**
 * Maps an Offering's packages onto Metriqo plans, keyed by the canonical
 * package id (`starter_monthly`). A package is recognised by its store
 * **product id** first (`metriqo_starter_monthly`, or Play's
 * `metriqo_starter_monthly:<basePlan>`), then by its package identifier — so
 * the dashboard's package naming ($rc_monthly, custom ids…) can't silently
 * hide a correctly configured product.
 */
export function matchOfferingPackages(offering: Pick<PurchasesOffering, 'availablePackages'>): Map<string, MatchedPackage> {
  const matched = new Map<string, MatchedPackage>();
  for (const pkg of offering.availablePackages) {
    const target = findPlanByProductId(pkg.product.identifier) ?? findPlanByPackageId(pkg.identifier);
    if (!target) continue; // an unrecognised product can never become a plan
    const key = PLAN_CONFIG[target.plan].products![target.period].packageId;
    if (!matched.has(key)) {
      matched.set(key, { ...target, pkg });
    }
  }
  return matched;
}

/** The eight `metriqo_<plan>_<period>` product ids the app expects. */
export function expectedProductIds(): string[] {
  return PAID_PLAN_IDS.flatMap((plan) => BILLING_PERIODS.map((period) => PLAN_CONFIG[plan].products![period].productId));
}

/**
 * The real adapter over `react-native-purchases` (RevenueCat's SDK). The same
 * code drives the RevenueCat Test Store (a `test_…` key, development builds
 * only) and Google Play (a `goog_…` key) — which key is decided by
 * `resolveRevenueCatConfig` (see `container.ts`). Three properties matter:
 *
 *  - The SDK is `require`d lazily, only once a call actually needs it. The
 *    module is missing/inert in Expo Go and in Jest, and a static import
 *    would crash app start there. When it's missing, `isAvailable()` is false
 *    and the app simply runs on its cached/Free state.
 *  - `Purchases.configure()` runs **exactly once**, before any other SDK call:
 *    every method awaits the same configure promise, and a JS reload (Fast
 *    Refresh) that rebuilds this adapter checks `isConfigured()` first.
 *  - Development builds log what RevenueCat returned (store, offering,
 *    packages, products, entitlement) with the API key masked.
 *
 * No Jest coverage for the SDK calls themselves — they need the native
 * module and a device; the logic that consumes this is tested against
 * `FakeRevenueCatAdapter`, and the pure helpers above are unit-tested.
 */
export class ReactNativePurchasesAdapter implements RevenueCatAdapter {
  private purchases: PurchasesModule | null = null;
  private configuring: Promise<PurchasesModule> | null = null;
  private lastPackages = new Map<string, PurchasesPackage>();

  constructor(
    private readonly config: RevenueCatConfig,
    private readonly platform: string = Platform.OS,
  ) {
    debugLog('config', {
      available: this.isAvailable(),
      store: config.store,
      apiKey: maskApiKey(config.apiKey),
      platform,
      issue: config.issue,
      expectedOffering: REVENUECAT_OFFERING_ID,
      expectedEntitlement: REVENUECAT_ENTITLEMENT_ID,
    });
  }

  isAvailable(): boolean {
    return (this.platform === 'android' || this.platform === 'ios') && !!this.config.apiKey;
  }

  getStoreKind(): RevenueCatStoreKind | null {
    return this.isAvailable() ? this.config.store : null;
  }

  getUnavailableReason(): string | null {
    if (this.isAvailable()) return null;
    return this.config.issue ?? 'In-app subscriptions are not configured for this build.';
  }

  private sdk(): Promise<PurchasesModule> {
    if (!this.isAvailable()) {
      return Promise.reject(new RevenueCatError('not_configured', this.getUnavailableReason()!));
    }
    if (this.purchases) {
      return Promise.resolve(this.purchases);
    }
    if (!this.configuring) {
      this.configuring = this.configure().catch((error) => {
        this.configuring = null; // allow a later retry
        throw error;
      });
    }
    return this.configuring;
  }

  private async configure(): Promise<PurchasesModule> {
    let purchases: PurchasesModule;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      purchases = require('react-native-purchases').default as PurchasesModule;
    } catch (error) {
      throw new RevenueCatError(
        'not_configured',
        error instanceof Error ? error.message : 'The subscription module is not in this build.',
      );
    }
    try {
      if (__DEV__) {
        await purchases.setLogLevel(purchases.LOG_LEVEL.DEBUG);
      }
      const already = await purchases.isConfigured().catch(() => false);
      if (!already) {
        purchases.configure({ apiKey: this.config.apiKey! });
      }
      debugLog(already ? 'SDK was already configured (JS reload) — reusing it' : 'SDK configured', {
        store: this.config.store,
        apiKey: maskApiKey(this.config.apiKey),
      });
    } catch (error) {
      debugLog('configure failed', error instanceof Error ? error.message : error);
      throw new RevenueCatError(
        'not_configured',
        error instanceof Error ? error.message : 'Could not start the subscription service.',
      );
    }
    this.purchases = purchases;
    return purchases;
  }

  /**
   * `react-native-purchases-ui` is a separate native module from
   * `react-native-purchases` — same lazy-require reasoning as `sdk()` (missing
   * in Expo Go/Jest). Requires `sdk()` to have configured the SDK first.
   */
  private async ui(): Promise<PurchasesUIModule> {
    await this.sdk();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('react-native-purchases-ui').default as PurchasesUIModule;
    } catch (error) {
      throw new RevenueCatError(
        'not_configured',
        error instanceof Error ? error.message : 'The paywall is not available in this build.',
      );
    }
  }

  private mapError(error: unknown): RevenueCatError {
    if (error instanceof RevenueCatError) {
      return error;
    }
    const codes = this.purchases?.PURCHASES_ERROR_CODE;
    const { code, message, userCancelled } = (error ?? {}) as {
      code?: string;
      message?: string;
      userCancelled?: boolean | null;
    };
    let kind: RevenueCatErrorKind = 'unknown';
    if (userCancelled || (codes && code === codes.PURCHASE_CANCELLED_ERROR)) {
      kind = 'cancelled';
    } else if (codes) {
      switch (code) {
        case codes.NETWORK_ERROR:
        case codes.OFFLINE_CONNECTION_ERROR:
          kind = 'network';
          break;
        case codes.STORE_PROBLEM_ERROR:
        case codes.PRODUCT_REQUEST_TIMED_OUT_ERROR:
          kind = 'store_unavailable';
          break;
        case codes.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        case codes.INELIGIBLE_ERROR:
          kind = 'product_unavailable';
          break;
        case codes.PRODUCT_ALREADY_PURCHASED_ERROR:
        case codes.RECEIPT_ALREADY_IN_USE_ERROR:
        case codes.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
          kind = 'already_purchased';
          break;
        case codes.PAYMENT_PENDING_ERROR:
          kind = 'pending';
          break;
        case codes.PURCHASE_NOT_ALLOWED_ERROR:
        case codes.PURCHASE_INVALID_ERROR:
          kind = 'not_allowed';
          break;
        case codes.CONFIGURATION_ERROR:
        case codes.INVALID_CREDENTIALS_ERROR:
          kind = 'configuration';
          break;
        default:
          kind = 'unknown';
      }
    }
    debugLog(`error ${code ?? '(no code)'} -> ${kind}`, message);
    return new RevenueCatError(kind, message ?? 'Something went wrong with the store.');
  }

  private logCustomerInfo(source: string, info: CustomerInfo): void {
    if (!__DEV__) return;
    const entitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
    debugLog(`customerInfo (${source})`, {
      entitlement: REVENUECAT_ENTITLEMENT_ID,
      active: !!entitlement?.isActive,
      productIdentifier: entitlement?.productIdentifier ?? null,
      store: entitlement?.store ?? null,
      expires: entitlement?.expirationDate ?? null,
      activeSubscriptions: info.activeSubscriptions,
      otherActiveEntitlements: Object.keys(info.entitlements.active).filter((id) => id !== REVENUECAT_ENTITLEMENT_ID),
    });
  }

  async getCustomerInfo(): Promise<CustomerInfoLike> {
    try {
      const info = await (await this.sdk()).getCustomerInfo();
      this.logCustomerInfo('getCustomerInfo', info);
      return toCustomerInfoLike(info);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Loads the `metriqo_premium` Offering (falling back to the dashboard's
   * *current* Offering) and maps its packages onto plans. Distinguishes the
   * setup problems that otherwise all look like "no plans": no Offering at
   * all, an Offering with no packages, and an Offering whose packages don't
   * carry any expected `metriqo_<plan>_<period>` product. Attaching a product
   * to the entitlement is NOT enough — it must also be a package in the
   * Offering for `getOfferings()` to return it.
   */
  async getOfferings(): Promise<StorePackage[]> {
    try {
      const offerings = await (await this.sdk()).getOfferings();
      const offering = offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current;
      debugLog('offerings', {
        store: this.config.store,
        allOfferings: Object.keys(offerings.all),
        current: offerings.current?.identifier ?? null,
        using: offering?.identifier ?? null,
        packages:
          offering?.availablePackages.map((pkg) => `${pkg.identifier} -> ${pkg.product.identifier} (${pkg.product.priceString})`) ?? [],
      });
      if (!offering) {
        throw new RevenueCatError(
          'configuration',
          Object.keys(offerings.all).length === 0
            ? `RevenueCat returned no Offerings. Create the "${REVENUECAT_OFFERING_ID}" Offering, add the plan packages and make it Current.`
            : `No "${REVENUECAT_OFFERING_ID}" Offering and no Current Offering is set in RevenueCat.`,
        );
      }
      if (offering.availablePackages.length === 0) {
        throw new RevenueCatError(
          'configuration',
          `The "${offering.identifier}" Offering has no packages for this store. Add packages for the metriqo_<plan>_<period> products.`,
        );
      }
      const matched = matchOfferingPackages(offering);
      if (matched.size === 0) {
        throw new RevenueCatError(
          'configuration',
          `The "${offering.identifier}" Offering has no metriqo_<plan>_<period> products ` +
            `(got: ${offering.availablePackages.map((pkg) => pkg.product.identifier).join(', ')}).`,
        );
      }
      const returned = new Set([...matched.values()].map(({ pkg }) => pkg.product.identifier.split(':')[0]));
      const missing = expectedProductIds().filter((productId) => !returned.has(productId));
      if (missing.length > 0) {
        debugLog('expected products missing from the Offering', missing);
      }

      this.lastPackages.clear();
      const packages: StorePackage[] = [];
      for (const [packageId, { plan, period, pkg }] of matched) {
        this.lastPackages.set(packageId, pkg);
        packages.push({
          plan,
          period,
          packageId,
          storeProductId: pkg.product.identifier,
          priceString: pkg.product.priceString,
          priceMicros: Math.round(pkg.product.price * 1_000_000),
          currencyCode: pkg.product.currencyCode,
        });
      }
      return packages;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async purchase(packageId: string, change?: ProductChange): Promise<CustomerInfoLike> {
    try {
      const purchases = await this.sdk();
      let pkg = this.lastPackages.get(packageId);
      if (!pkg) {
        await this.getOfferings();
        pkg = this.lastPackages.get(packageId);
      }
      if (!pkg) {
        throw new RevenueCatError('product_unavailable', 'That plan is not available right now.');
      }
      const modes = purchases.STORE_REPLACEMENT_MODE;
      const productChangeInfo = change
        ? {
            oldProductIdentifier: change.oldProductIdentifier,
            replacementMode: change.timing === 'immediate' ? modes.WITH_TIME_PRORATION : modes.DEFERRED,
          }
        : null;
      debugLog('purchasePackage', { packageId, product: pkg.product.identifier, change: change ?? null });
      const result = await purchases.purchasePackage(pkg, null, productChangeInfo);
      this.logCustomerInfo('purchase', result.customerInfo);
      return toCustomerInfoLike(result.customerInfo);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async restore(): Promise<CustomerInfoLike> {
    try {
      const info = await (await this.sdk()).restorePurchases();
      this.logCustomerInfo('restorePurchases', info);
      return toCustomerInfoLike(info);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async logIn(appUserId: string): Promise<CustomerInfoLike> {
    try {
      const { customerInfo } = await (await this.sdk()).logIn(appUserId);
      this.logCustomerInfo('logIn', customerInfo);
      return toCustomerInfoLike(customerInfo);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async logOut(): Promise<CustomerInfoLike> {
    try {
      return toCustomerInfoLike(await (await this.sdk()).logOut());
    } catch (error) {
      throw this.mapError(error);
    }
  }

  addCustomerInfoListener(listener: (info: CustomerInfoLike) => void): () => void {
    const wrapped = (info: CustomerInfo) => {
      this.logCustomerInfo('listener', info);
      listener(toCustomerInfoLike(info));
    };
    let stopped = false;
    let registered: PurchasesModule | null = null;
    this.sdk()
      .then((purchases) => {
        if (stopped) return;
        purchases.addCustomerInfoUpdateListener(wrapped);
        registered = purchases;
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      registered?.removeCustomerInfoUpdateListener(wrapped);
    };
  }

  async presentPaywall(): Promise<PaywallPresentationResult> {
    try {
      const RevenueCatUI = await this.ui();
      const offering = (await (await this.sdk()).getOfferings()).all[REVENUECAT_OFFERING_ID];
      const result = await RevenueCatUI.presentPaywall(offering ? { offering } : undefined);
      switch (result) {
        case RevenueCatUI.PAYWALL_RESULT.PURCHASED:
          return 'purchased';
        case RevenueCatUI.PAYWALL_RESULT.RESTORED:
          return 'restored';
        case RevenueCatUI.PAYWALL_RESULT.CANCELLED:
          return 'cancelled';
        case RevenueCatUI.PAYWALL_RESULT.NOT_PRESENTED:
          return 'not_presented';
        default:
          return 'error';
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async presentCustomerCenter(): Promise<void> {
    try {
      await (await this.ui()).presentCustomerCenter();
    } catch (error) {
      throw this.mapError(error);
    }
  }
}
