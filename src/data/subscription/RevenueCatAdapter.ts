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
 * How RevenueCat's hosted Paywall UI (`react-native-purchases-ui`) was left.
 * `purchased`/`restored` mean the SDK itself confirmed the entitlement before
 * closing the paywall — no separate "was it really active?" check is needed
 * the way `RevenueCatAdapter.purchase()` requires one.
 */
export type PaywallPresentationResult = 'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error';

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
  /**
   * Switches the RevenueCat identity to `appUserId` — Invora's own stable
   * `local_user_id`, never a RevenueCat-generated one (see `db/schema.ts`'s
   * `user_identity` doc comment). If `appUserId` has never been seen by
   * RevenueCat before, it automatically aliases it to the current (often
   * anonymous) session, carrying its purchase history over — the common case
   * for a guest's first identify, since a freshly generated id is by
   * definition unseen. If `appUserId` already has its own separate
   * subscriber record (e.g. a Google account previously used to purchase on
   * another device), RevenueCat returns *that* record instead — the current
   * session's entitlement is not carried over. Safe to call repeatedly; a
   * no-op when already identified as this id.
   */
  logIn(appUserId: string): Promise<CustomerInfoLike>;
  /** Returns RevenueCat to a fresh anonymous identity (e.g. an explicit Google sign-out). */
  logOut(): Promise<CustomerInfoLike>;
  /**
   * Presents RevenueCat's hosted Paywall UI for the `default` Offering
   * (the one holding all eight packages) — the multi-tier paywall built in
   * the RevenueCat dashboard picks the plan; this call doesn't. Rejects with
   * `RevenueCatError` only when the paywall couldn't be shown at all (e.g.
   * not configured); a normal dismissal resolves with `'cancelled'`.
   */
  presentPaywall(): Promise<PaywallPresentationResult>;
  /**
   * Presents RevenueCat's hosted Customer Center (manage/cancel/get help).
   * Resolves once the user closes it. Any change made inside it (a
   * cancellation, a plan switch) reaches `SubscriptionService` the same way
   * as any other RevenueCat-initiated change: through `addCustomerInfoListener`.
   */
  presentCustomerCenter(): Promise<void>;
}
