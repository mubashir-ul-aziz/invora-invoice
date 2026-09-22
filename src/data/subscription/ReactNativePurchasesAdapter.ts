import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesEntitlementInfo, PurchasesPackage } from 'react-native-purchases';

import type { CustomerInfoLike, EntitlementInfoLike } from '@/domain/subscription/entitlementMapping';
import { REVENUECAT_OFFERING_ID, findPlanByPackageId } from '@/domain/subscription/plans';

import {
  RevenueCatError,
  type ProductChange,
  type RevenueCatAdapter,
  type RevenueCatErrorKind,
  type StorePackage,
} from './RevenueCatAdapter';

type PurchasesModule = typeof import('react-native-purchases').default;

function mapEntitlement(entitlement: PurchasesEntitlementInfo): EntitlementInfoLike {
  return {
    isActive: entitlement.isActive,
    willRenew: entitlement.willRenew,
    expirationDateMillis: entitlement.expirationDateMillis,
    productIdentifier: entitlement.productIdentifier,
    productPlanIdentifier: entitlement.productPlanIdentifier,
    billingIssueDetectedAtMillis: entitlement.billingIssueDetectedAtMillis,
  };
}

function mapEntitlements(entitlements: Record<string, PurchasesEntitlementInfo>): Record<string, EntitlementInfoLike> {
  const mapped: Record<string, EntitlementInfoLike> = {};
  for (const [id, entitlement] of Object.entries(entitlements)) {
    mapped[id] = mapEntitlement(entitlement);
  }
  return mapped;
}

/** Keeps only the fields Invora's mapping reads — no raw purchase data crosses this boundary. */
export function toCustomerInfoLike(info: CustomerInfo): CustomerInfoLike {
  const requestDate = Date.parse(info.requestDate);
  return {
    entitlements: {
      active: mapEntitlements(info.entitlements.active),
      all: mapEntitlements(info.entitlements.all),
    },
    managementURL: info.managementURL,
    requestDateMillis: Number.isNaN(requestDate) ? null : requestDate,
  };
}

/**
 * The real adapter over `react-native-purchases` (RevenueCat's SDK, which
 * drives Google Play Billing). Two properties matter:
 *
 *  - The SDK is `require`d lazily, only once a call actually needs it. The
 *    module is missing/inert in Expo Go and in Jest, and a static import
 *    would crash app start there. When it's missing, `isAvailable()` is false
 *    and the app simply runs on its cached/Free state.
 *  - The API key is a RevenueCat *public* SDK key (`goog_…`) read from
 *    `expo.extra.revenueCatAndroidApiKey` — safe to ship, unlike a secret
 *    key. Empty = RevenueCat isn't configured for this build.
 *
 * No Jest coverage — it needs the native module and a device, same as every
 * other native-backed service in this codebase (`ExpoGoogleDriveBackupService`,
 * `ExpoBiometricService`); the logic that consumes it is tested against
 * `FakeRevenueCatAdapter`.
 */
export class ReactNativePurchasesAdapter implements RevenueCatAdapter {
  private purchases: PurchasesModule | null = null;
  private lastPackages = new Map<string, PurchasesPackage>();

  constructor(
    private readonly apiKey: string,
    private readonly platform: string = Platform.OS,
  ) {}

  isAvailable(): boolean {
    return this.platform === 'android' && this.apiKey.length > 0;
  }

  private sdk(): PurchasesModule {
    if (!this.isAvailable()) {
      throw new RevenueCatError('not_configured', 'In-app subscriptions are not configured for this build.');
    }
    if (!this.purchases) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const purchases = require('react-native-purchases').default as PurchasesModule;
        purchases.configure({ apiKey: this.apiKey });
        this.purchases = purchases;
      } catch (error) {
        throw new RevenueCatError(
          'not_configured',
          error instanceof Error ? error.message : 'Could not start the subscription service.',
        );
      }
    }
    return this.purchases;
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
          kind = 'not_configured';
          break;
        default:
          kind = 'unknown';
      }
    }
    return new RevenueCatError(kind, message ?? 'Something went wrong with the store.');
  }

  async getCustomerInfo(): Promise<CustomerInfoLike> {
    try {
      return toCustomerInfoLike(await this.sdk().getCustomerInfo());
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async getOfferings(): Promise<StorePackage[]> {
    try {
      const offerings = await this.sdk().getOfferings();
      const offering = offerings.all[REVENUECAT_OFFERING_ID] ?? offerings.current;
      if (!offering) {
        throw new RevenueCatError('product_unavailable', 'No subscription plans are available right now.');
      }
      this.lastPackages.clear();
      const packages: StorePackage[] = [];
      for (const pkg of offering.availablePackages) {
        const target = findPlanByPackageId(pkg.identifier);
        if (!target) continue; // an unrecognised package can never become a plan
        this.lastPackages.set(pkg.identifier, pkg);
        packages.push({
          plan: target.plan,
          period: target.period,
          packageId: pkg.identifier,
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
      const purchases = this.sdk();
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
      const result = await purchases.purchasePackage(pkg, null, productChangeInfo);
      return toCustomerInfoLike(result.customerInfo);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async restore(): Promise<CustomerInfoLike> {
    try {
      return toCustomerInfoLike(await this.sdk().restorePurchases());
    } catch (error) {
      throw this.mapError(error);
    }
  }

  addCustomerInfoListener(listener: (info: CustomerInfoLike) => void): () => void {
    let purchases: PurchasesModule;
    try {
      purchases = this.sdk();
    } catch {
      return () => {};
    }
    const wrapped = (info: CustomerInfo) => listener(toCustomerInfoLike(info));
    purchases.addCustomerInfoUpdateListener(wrapped);
    return () => {
      purchases.removeCustomerInfoUpdateListener(wrapped);
    };
  }
}
