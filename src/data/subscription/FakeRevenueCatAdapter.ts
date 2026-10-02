import type { CustomerInfoLike } from '@/domain/subscription/entitlementMapping';
import {
  PAID_PLAN_IDS,
  BILLING_PERIODS,
  PLAN_CONFIG,
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
import type { RevenueCatStoreKind } from './revenueCatConfig';

export const EMPTY_CUSTOMER_INFO: CustomerInfoLike = { entitlements: { active: {}, all: {} } };

/**
 * Test-only stand-in for what a store would return for each package. The app
 * itself has no local prices — real ones come from the RevenueCat Offering.
 */
const FAKE_STORE_PRICES_USD: Record<PaidPlanId, Record<BillingPeriod, number>> = {
  starter: { monthly: 5, yearly: 48 },
  business: { monthly: 10, yearly: 96 },
  pro: { monthly: 15, yearly: 144 },
  unlimited: { monthly: 20, yearly: 192 },
};

export function buildFakePackages(): StorePackage[] {
  const packages: StorePackage[] = [];
  for (const plan of PAID_PLAN_IDS) {
    for (const period of BILLING_PERIODS) {
      const usd = FAKE_STORE_PRICES_USD[plan][period];
      packages.push({
        plan,
        period,
        packageId: PLAN_CONFIG[plan].products![period].packageId,
        storeProductId: PLAN_CONFIG[plan].products![period].productId,
        priceString: `$${usd.toFixed(2)}`,
        priceMicros: usd * 1_000_000,
        currencyCode: 'USD',
      });
    }
  }
  return packages;
}

/**
 * In-memory stand-in for RevenueCat/Google Play — no SDK, no network. Tests
 * script its answers (`setCustomerInfo`, `failNext`, `onPurchase`) to drive
 * `SubscriptionService` through success, cancellation, pending, offline and
 * every other outcome deterministically.
 */
export class FakeRevenueCatAdapter implements RevenueCatAdapter {
  available = true;
  storeKind: RevenueCatStoreKind = 'test_store';
  unavailableReason = 'No RevenueCat key in this bundle.';
  customerInfo: CustomerInfoLike = EMPTY_CUSTOMER_INFO;
  packages: StorePackage[] = buildFakePackages();
  /** What `restore()` resolves with; defaults to the current customer info. */
  restoreResult: CustomerInfoLike | null = null;
  /** What `purchase()` resolves with, given the package; defaults to leaving customer info unchanged. */
  onPurchase: ((packageId: string, change?: ProductChange) => CustomerInfoLike) | null = null;
  /** What `presentPaywall()` resolves with; defaults to the user dismissing it. */
  paywallResult: PaywallPresentationResult = 'cancelled';
  /** What customer info looks like after `presentPaywall()` resolves `'purchased'`/`'restored'`; defaults to leaving it unchanged. */
  onPaywallPresented: (() => CustomerInfoLike) | null = null;

  readonly calls = {
    getCustomerInfo: 0,
    getOfferings: 0,
    purchase: [] as { packageId: string; change?: ProductChange }[],
    restore: 0,
    logIn: [] as string[],
    logOut: 0,
    presentPaywall: 0,
    presentCustomerCenter: 0,
  };

  private failures: RevenueCatErrorKind[] = [];
  private purchaseFailures: RevenueCatErrorKind[] = [];
  private listeners = new Set<(info: CustomerInfoLike) => void>();
  /**
   * Simulates RevenueCat's own per-appUserId subscriber records. Logging in
   * as an id never seen before auto-aliases it to the current session (real
   * RevenueCat behavior — the current `customerInfo`, including any active
   * entitlement, carries over). Logging in as an id that already has its own
   * seeded record (`seedCustomerForUser`) switches to that record instead,
   * without carrying over the current session — mirrors real RevenueCat's
   * "this id already has separate history" case.
   */
  private customersByUser = new Map<string, CustomerInfoLike>();

  /** The next SDK call (of any kind) rejects with this error kind. */
  failNext(kind: RevenueCatErrorKind): void {
    this.failures.push(kind);
  }

  /**
   * The next `purchase()` call rejects with this error kind. Unlike
   * `failNext`, it isn't consumed by the CustomerInfo fetch that
   * `SubscriptionService.purchase()` makes before buying.
   */
  failNextPurchase(kind: RevenueCatErrorKind): void {
    this.purchaseFailures.push(kind);
  }

  setCustomerInfo(info: CustomerInfoLike): void {
    this.customerInfo = info;
  }

  /** Simulates RevenueCat pushing a CustomerInfo update to the SDK's listener. */
  emit(info: CustomerInfoLike): void {
    this.customerInfo = info;
    this.listeners.forEach((listener) => listener(info));
  }

  isAvailable(): boolean {
    return this.available;
  }

  getStoreKind(): RevenueCatStoreKind | null {
    return this.available ? this.storeKind : null;
  }

  getUnavailableReason(): string | null {
    return this.available ? null : this.unavailableReason;
  }

  private maybeFail(): void {
    const kind = this.failures.shift();
    if (kind) {
      throw new RevenueCatError(kind, `fake ${kind} error`);
    }
  }

  async getCustomerInfo(): Promise<CustomerInfoLike> {
    this.calls.getCustomerInfo += 1;
    this.maybeFail();
    return this.customerInfo;
  }

  async getOfferings(): Promise<StorePackage[]> {
    this.calls.getOfferings += 1;
    this.maybeFail();
    return this.packages;
  }

  async purchase(packageId: string, change?: ProductChange): Promise<CustomerInfoLike> {
    this.calls.purchase.push({ packageId, change });
    this.maybeFail();
    const purchaseFailure = this.purchaseFailures.shift();
    if (purchaseFailure) {
      throw new RevenueCatError(purchaseFailure, `fake ${purchaseFailure} error`);
    }
    if (!this.packages.some((pkg) => pkg.packageId === packageId)) {
      throw new RevenueCatError('product_unavailable', 'unknown package');
    }
    if (this.onPurchase) {
      this.customerInfo = this.onPurchase(packageId, change);
    }
    return this.customerInfo;
  }

  async restore(): Promise<CustomerInfoLike> {
    this.calls.restore += 1;
    this.maybeFail();
    if (this.restoreResult) {
      this.customerInfo = this.restoreResult;
    }
    return this.customerInfo;
  }

  addCustomerInfoListener(listener: (info: CustomerInfoLike) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async logIn(appUserId: string): Promise<CustomerInfoLike> {
    this.calls.logIn.push(appUserId);
    this.maybeFail();
    const existing = this.customersByUser.get(appUserId);
    if (existing) {
      this.customerInfo = existing;
    } else {
      this.customersByUser.set(appUserId, this.customerInfo);
    }
    return this.customerInfo;
  }

  async logOut(): Promise<CustomerInfoLike> {
    this.calls.logOut += 1;
    this.maybeFail();
    this.customerInfo = EMPTY_CUSTOMER_INFO;
    return this.customerInfo;
  }

  /** Test helper: seeds what `logIn(appUserId)` returns for an id RevenueCat already knows (e.g. a Google account linked on another device). */
  seedCustomerForUser(appUserId: string, info: CustomerInfoLike): void {
    this.customersByUser.set(appUserId, info);
  }

  async presentPaywall(): Promise<PaywallPresentationResult> {
    this.calls.presentPaywall += 1;
    this.maybeFail();
    if ((this.paywallResult === 'purchased' || this.paywallResult === 'restored') && this.onPaywallPresented) {
      this.customerInfo = this.onPaywallPresented();
    }
    return this.paywallResult;
  }

  async presentCustomerCenter(): Promise<void> {
    this.calls.presentCustomerCenter += 1;
    this.maybeFail();
  }
}
