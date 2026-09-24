import type { CustomerInfoLike } from '@/domain/subscription/entitlementMapping';
import type { BillingPeriod, PaidPlanId } from '@/domain/subscription/plans';

/** Everything that can go wrong talking to RevenueCat/Google Play, normalized so nothing above the adapter sees SDK error codes. */
export type RevenueCatErrorKind =
  | 'cancelled'
  | 'network'
  | 'store_unavailable'
  | 'product_unavailable'
  | 'already_purchased'
  | 'pending'
  | 'not_allowed'
  | 'not_configured'
  | 'unknown';

export class RevenueCatError extends Error {
  readonly kind: RevenueCatErrorKind;

  constructor(kind: RevenueCatErrorKind, message: string) {
    super(message);
    this.name = 'RevenueCatError';
    this.kind = kind;
  }
}

/** One purchasable RevenueCat package, mapped onto an Metriqo plan + billing period. */
export interface StorePackage {
  plan: PaidPlanId;
  period: BillingPeriod;
  /** RevenueCat package identifier, e.g. `starter_monthly`. */
  packageId: string;
  storeProductId: string;
  /** Localized, store-formatted price — the only price shown to the user once offerings load. */
  priceString: string;
  /** Price in millionths of `currencyCode`, for savings arithmetic. */
  priceMicros: number;
  currencyCode: string;
}

/** Tells Google Play to replace the user's existing subscription instead of creating a second one. */
export interface ProductChange {
  /** The Google Play subscription id being replaced, e.g. `metriqo_starter`. */
  oldProductIdentifier: string;
  timing: 'immediate' | 'deferred';
}

/**
 * The single seam between Metriqo and the RevenueCat SDK. Everything above it
 * (`SubscriptionService`, stores, screens) speaks only these types, so the
 * SDK stays swappable/mockable and never leaks into UI or domain code.
 * RevenueCat is the subscription authority; Google Play performs the actual
 * transaction. Metriqo never sees card or payment details.
 */
export interface RevenueCatAdapter {
  /** False when there's no API key, the platform isn't Android, or the native module isn't in this build (e.g. Expo Go). Nothing else may be called then. */
  isAvailable(): boolean;
  getCustomerInfo(): Promise<CustomerInfoLike>;
  getOfferings(): Promise<StorePackage[]>;
  /** Starts Google Play's purchase sheet for a package and resolves with RevenueCat's CustomerInfo. Rejects with `RevenueCatError`. */
  purchase(packageId: string, change?: ProductChange): Promise<CustomerInfoLike>;
  restore(): Promise<CustomerInfoLike>;
  /** Returns an unsubscribe function. */
  addCustomerInfoListener(listener: (info: CustomerInfoLike) => void): () => void;
}
