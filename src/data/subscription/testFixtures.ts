import type { CustomerInfoLike, EntitlementInfoLike } from '@/domain/subscription/entitlementMapping';
import { PLAN_CONFIG, type BillingPeriod, type PaidPlanId } from '@/domain/subscription/plans';

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
}

export function activeInfo(plan: PaidPlanId, now: number, options: ActiveInfoOptions = {}): CustomerInfoLike {
  const period = options.period ?? 'monthly';
  const entitlement: EntitlementInfoLike = {
    isActive: true,
    willRenew: options.willRenew ?? true,
    expirationDateMillis: options.expiresAt ?? now + 30 * DAY,
    productIdentifier: PLAN_CONFIG[plan].products![period].storeProductId,
    productPlanIdentifier: PLAN_CONFIG[plan].products![period].basePlanId,
    billingIssueDetectedAtMillis: options.billingIssue ? now - DAY : null,
  };
  return {
    entitlements: { active: { [PLAN_CONFIG[plan].entitlementId!]: entitlement }, all: { [PLAN_CONFIG[plan].entitlementId!]: entitlement } },
    managementURL: 'https://play.google.com/store/account/subscriptions?package=com.invora.invoice',
    requestDateMillis: options.requestDate === undefined ? now : options.requestDate,
  };
}

export function lapsedInfo(plan: PaidPlanId, now: number): CustomerInfoLike {
  const entitlement: EntitlementInfoLike = {
    isActive: false,
    willRenew: false,
    expirationDateMillis: now - 2 * DAY,
    productIdentifier: PLAN_CONFIG[plan].products!.monthly.storeProductId,
    productPlanIdentifier: 'monthly',
    billingIssueDetectedAtMillis: null,
  };
  return {
    entitlements: { active: {}, all: { [PLAN_CONFIG[plan].entitlementId!]: entitlement } },
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
  const make = () => new SubscriptionService(adapter, cache, connectivity, () => clock.now);
  return { clock, adapter, connectivity, rawStore, signer, cache, service: make(), restart: make };
}
