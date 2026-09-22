import type { CustomerInfoLike } from '@/domain/subscription/entitlementMapping';
import { PAID_PLAN_IDS, BILLING_PERIODS, PLAN_CONFIG } from '@/domain/subscription/plans';

import {
  RevenueCatError,
  type ProductChange,
  type RevenueCatAdapter,
  type RevenueCatErrorKind,
  type StorePackage,
} from './RevenueCatAdapter';

export const EMPTY_CUSTOMER_INFO: CustomerInfoLike = { entitlements: { active: {}, all: {} } };

/** Store prices in USD micros for every package — mirrors `PLAN_CONFIG.fallbackPriceUsd`. */
export function buildFakePackages(): StorePackage[] {
  const packages: StorePackage[] = [];
  for (const plan of PAID_PLAN_IDS) {
    for (const period of BILLING_PERIODS) {
      const usd = PLAN_CONFIG[plan].fallbackPriceUsd[period];
      packages.push({
        plan,
        period,
        packageId: PLAN_CONFIG[plan].products![period].packageId,
        storeProductId: PLAN_CONFIG[plan].products![period].storeProductId,
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
  customerInfo: CustomerInfoLike = EMPTY_CUSTOMER_INFO;
  packages: StorePackage[] = buildFakePackages();
  /** What `restore()` resolves with; defaults to the current customer info. */
  restoreResult: CustomerInfoLike | null = null;
  /** What `purchase()` resolves with, given the package; defaults to leaving customer info unchanged. */
  onPurchase: ((packageId: string, change?: ProductChange) => CustomerInfoLike) | null = null;

  readonly calls = { getCustomerInfo: 0, getOfferings: 0, purchase: [] as { packageId: string; change?: ProductChange }[], restore: 0 };

  private failures: RevenueCatErrorKind[] = [];
  private listeners = new Set<(info: CustomerInfoLike) => void>();

  /** The next SDK call (of any kind) rejects with this error kind. */
  failNext(kind: RevenueCatErrorKind): void {
    this.failures.push(kind);
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
}
