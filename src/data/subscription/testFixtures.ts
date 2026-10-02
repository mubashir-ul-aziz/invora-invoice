import type { CustomerInfoLike, EntitlementInfoLike } from '@/domain/subscription/entitlementMapping';
import { PLAN_CONFIG, REVENUECAT_ENTITLEMENT_ID, type BillingPeriod, type PaidPlanId } from '@/domain/subscription/plans';

import { FakeConnectivityService } from './ConnectivityService';
import { EMPTY_CUSTOMER_INFO, FakeRevenueCatAdapter } from './FakeRevenueCatAdapter';
import { FakeSubscriptionCacheSigner, InMemoryRawSubscriptionCacheStore } from './InMemorySubscriptionCache';
import { SignedSubscriptionCacheRepository } from './SignedSubscriptionCacheRepository';
import { SubscriptionCache } from './SubscriptionCache';
import { SubscriptionService } from './SubscriptionService';

export const DAY = 86_400_000;
export const START = new Date(2026, 8, 10, 12, 0, 0).getTime();

interface ActiveInfoOptions {
  period?: BillingPeriod;
  willRenew?: boolean;
  billingIssue?: boolean;
  /** Epoch ms RevenueCat "answered" at. Defaults to the harness clock. */
  requestDate?: number | null;
  expiresAt?: number;
  /** RevenueCat store of the entitlement. Defaults to Google Play. */
  store?: 'PLAY_STORE' | 'TEST_STORE';
  /** Override RevenueCat's `managementURL` (null = none supplied). */
  managementURL?: string | null;
}

/** A CustomerInfo with the `metriqo_premium` entitlement active via `plan`'s product for `options.period`. */
export function activeInfo(plan: PaidPlanId, now: number, options: ActiveInfoOptions = {}): CustomerInfoLike {
  const period = options.period ?? 'monthly';
  const productId = PLAN_CONFIG[plan].products![period].productId;
  const entitlement: EntitlementInfoLike = {
    isActive: true,
    willRenew: options.willRenew ?? true,
    expirationDateMillis: options.expiresAt ?? now + 30 * DAY,
    productIdentifier: productId,
    billingIssueDetectedAtMillis: options.billingIssue ? now - DAY : null,
    store: options.store ?? 'PLAY_STORE',
  };
  return {
    entitlements: {
      active: { [REVENUECAT_ENTITLEMENT_ID]: entitlement },
      all: { [REVENUECAT_ENTITLEMENT_ID]: entitlement },
    },
    activeSubscriptions: [productId],
    managementURL:
      options.managementURL !== undefined
        ? options.managementURL
        : 'https://play.google.com/store/account/subscriptions?package=com.metriqo.invoice',
    requestDateMillis: options.requestDate === undefined ? now : options.requestDate,
  };
}

/** A CustomerInfo whose `metriqo_premium` entitlement (from `plan`'s monthly product) expired two days ago. */
export function lapsedInfo(plan: PaidPlanId, now: number): CustomerInfoLike {
  const entitlement: EntitlementInfoLike = {
    isActive: false,
    willRenew: false,
    expirationDateMillis: now - 2 * DAY,
    productIdentifier: PLAN_CONFIG[plan].products!.monthly.productId,
    billingIssueDetectedAtMillis: null,
  };
  return {
    entitlements: { active: {}, all: { [REVENUECAT_ENTITLEMENT_ID]: entitlement } },
    activeSubscriptions: [],
    requestDateMillis: now,
  };
}

export { EMPTY_CUSTOMER_INFO };

export interface Harness {
  clock: { now: number };
  adapter: FakeRevenueCatAdapter;
  connectivity: FakeConnectivityService;
  rawStore: InMemoryRawSubscriptionCacheStore;
  signer: FakeSubscriptionCacheSigner;
  cache: SubscriptionCache;
  service: SubscriptionService;
  /** Every "PLAN CHANGE" diagnostics block the service logged, oldest first. */
  logs: string[];
  /** A brand-new service over the same cache/adapter — models an app restart. */
  restart(): SubscriptionService;
}

export function makeHarness(startAt: number = START): Harness {
  const clock = { now: startAt };
  const adapter = new FakeRevenueCatAdapter();
  const connectivity = new FakeConnectivityService(true);
  const rawStore = new InMemoryRawSubscriptionCacheStore();
  const signer = new FakeSubscriptionCacheSigner();
  const cache = new SubscriptionCache(new SignedSubscriptionCacheRepository(rawStore, signer));
  const logs: string[] = [];
  const make = () => new SubscriptionService(adapter, cache, connectivity, () => clock.now, (message) => logs.push(message));
  return { clock, adapter, connectivity, rawStore, signer, cache, service: make(), logs, restart: make };
}
