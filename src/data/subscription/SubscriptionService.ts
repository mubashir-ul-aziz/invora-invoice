import { normalizeCustomerInfo, type CustomerInfoLike } from '@/domain/subscription/entitlementMapping';
import { resolveEffectivePlan } from '@/domain/subscription/offlinePolicy';
import { planChangeKind, type PlanChangeKind } from '@/domain/subscription/planChange';
import {
  PLAN_CONFIG,
  isPaidPlan,
  planRank,
  type BillingPeriod,
  type PaidPlanId,
} from '@/domain/subscription/plans';
import { deriveDisplayStatus } from '@/domain/subscription/status';
import {
  EMPTY_CACHE_RECORD,
  INITIAL_SNAPSHOT,
  type NormalizedSubscription,
  type SubscriptionCacheRecord,
  type SubscriptionSnapshot,
} from '@/domain/subscription/types';

import type { ConnectivityService } from './ConnectivityService';
import { RevenueCatError, type ProductChange, type RevenueCatAdapter, type StorePackage } from './RevenueCatAdapter';
import type { SubscriptionCache } from './SubscriptionCache';

/** Google's documented subscription-management page. Used only when RevenueCat supplies no `managementURL` of its own. */
export const DEFAULT_MANAGE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/** A RevenueCat answer whose server timestamp is within this of the device clock counts as fresh (i.e. not the SDK's offline cache). */
export const FRESH_TOLERANCE_MS = 15 * 60 * 1000;
/** Don't rewrite the clock high-water mark more often than this. */
const CLOCK_WRITE_INTERVAL_MS = 60 * 1000;

export type SyncTrigger = 'startup' | 'foreground' | 'connectivity' | 'screen' | 'listener';

export type PurchaseOutcome =
  /** Google Play + RevenueCat confirmed an active entitlement for the chosen plan. */
  | { status: 'success'; snapshot: SubscriptionSnapshot }
  /** Google Play accepted a plan change that starts at the next renewal. Nothing was charged now. */
  | { status: 'scheduled'; snapshot: SubscriptionSnapshot }
  /** The store hasn't confirmed the payment yet (e.g. a pending Play transaction). Nothing is unlocked. */
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'already_subscribed'; snapshot: SubscriptionSnapshot }
  | { status: 'network_error' }
  | { status: 'store_unavailable' }
  | { status: 'product_unavailable' }
  /** RevenueCat isn't configured for this build (no key / not Android / no native module). */
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

export type RestoreOutcome =
  | { status: 'restored'; snapshot: SubscriptionSnapshot }
  | { status: 'already_active'; snapshot: SubscriptionSnapshot }
  | { status: 'nothing_to_restore'; snapshot: SubscriptionSnapshot }
  | { status: 'network_error' }
  | { status: 'store_unavailable' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

export type PaywallOutcome =
  /** RevenueCat's paywall confirmed the entitlement itself — no separate confirmation check, unlike `purchase()`. */
  | { status: 'purchased'; snapshot: SubscriptionSnapshot }
  | { status: 'restored'; snapshot: SubscriptionSnapshot }
  | { status: 'cancelled' }
  /** The paywall had nothing to show (e.g. the user already has every entitlement it offers). */
  | { status: 'not_presented' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

export type CustomerCenterOutcome =
  | { status: 'shown' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

export type IdentifyOutcome =
  | { status: 'identified'; snapshot: SubscriptionSnapshot }
  /** Already logged in to RevenueCat as this `localUserId` — nothing to do. */
  | { status: 'already_identified'; snapshot: SubscriptionSnapshot }
  | { status: 'network_error' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

function toNormalized(record: SubscriptionCacheRecord): NormalizedSubscription {
  return {
    plan: record.plan,
    isActive: record.isActive,
    expiresAt: record.expiresAt,
    willRenew: record.willRenew,
    billingIssue: record.billingIssue,
    billingPeriod: record.billingPeriod,
    lastSyncedAt: record.lastSyncedAt,
    source: record.source,
  };
}

/**
 * Orchestrates RevenueCat (the subscription authority) and the on-device
 * cache (an offline fallback only). It holds the current
 * `SubscriptionSnapshot`, refreshes it from RevenueCat when it can, and falls
 * back to the cache under the documented offline policy when it can't. It
 * never invents a paid plan: a plan only ever comes from a RevenueCat
 * `CustomerInfo`, and "purchase succeeded" is reported only after RevenueCat
 * returns an active entitlement for the plan that was bought.
 *
 * It never touches card or payment data — Google Play handles the
 * transaction; this class only sees the resulting CustomerInfo.
 */
export class SubscriptionService {
  private snapshot: SubscriptionSnapshot = INITIAL_SNAPSHOT;
  private record: SubscriptionCacheRecord = EMPTY_CACHE_RECORD;
  private verified = false;
  private isOffline = false;
  private managementUrl: string | null = null;
  private inflightRefresh: Promise<SubscriptionSnapshot> | null = null;
  private offerings: StorePackage[] | null = null;
  private listeners = new Set<(snapshot: SubscriptionSnapshot) => void>();

  constructor(
    private readonly adapter: RevenueCatAdapter,
    private readonly cache: SubscriptionCache,
    private readonly connectivity: ConnectivityService,
    private readonly now: () => number = Date.now,
  ) {}

  getSnapshot(): SubscriptionSnapshot {
    return this.snapshot;
  }

  /** Subscribes to snapshot changes. Returns an unsubscribe function. */
  subscribe(listener: (snapshot: SubscriptionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isRevenueCatAvailable(): boolean {
    return this.adapter.isAvailable();
  }

  /**
   * Where "Manage subscription" should open — RevenueCat's own link when it
   * has one (a Google Play page for a Play subscription), otherwise Google's
   * documented subscriptions page. Only `https://` links are ever opened.
   */
  getManagementUrl(): string {
    const url = this.snapshot.managementUrl;
    return url && /^https:\/\//i.test(url) ? url : DEFAULT_MANAGE_SUBSCRIPTIONS_URL;
  }

  private publish(record: SubscriptionCacheRecord): SubscriptionSnapshot {
    this.record = record;
    const subscription = toNormalized(record);
    const { plan, trust } = resolveEffectivePlan({
      subscription,
      now: this.now(),
      clockHighWaterMs: record.clockHighWaterMs,
      verifiedThisSession: this.verified,
    });
    this.snapshot = {
      plan,
      trust,
      status: deriveDisplayStatus({
        subscription,
        plan,
        trust,
        isOffline: this.isOffline,
        busy: null,
        purchasePending: false,
      }),
      subscription,
      isOffline: this.isOffline,
      clockHighWaterMs: record.clockHighWaterMs,
      managementUrl: this.managementUrl,
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
    return this.snapshot;
  }

  /** Cold start: publishes whatever the cache holds (or Free) immediately, before any network call. */
  async loadCached(): Promise<SubscriptionSnapshot> {
    this.verified = false;
    return this.publish(await this.cache.read());
  }

  /**
   * Advances the "latest device time ever seen" mark so a rolled-back clock
   * gains nothing. Cheap: skips the write unless a minute has passed.
   */
  async touchClock(): Promise<SubscriptionCacheRecord> {
    const current = await this.cache.read();
    const now = this.now();
    if (now - current.clockHighWaterMs < CLOCK_WRITE_INTERVAL_MS) {
      return current;
    }
    return this.cache.update((cur) => ({ ...cur, clockHighWaterMs: Math.max(cur.clockHighWaterMs, now) }));
  }

  /**
   * Asks RevenueCat for the current CustomerInfo, maps it, updates the cache
   * and publishes. If RevenueCat can't be reached, publishes the cached state
   * under the offline policy instead of downgrading. Concurrent calls share
   * one in-flight request.
   */
  refresh(_trigger: SyncTrigger = 'screen'): Promise<SubscriptionSnapshot> {
    if (!this.inflightRefresh) {
      this.inflightRefresh = this.doRefresh().finally(() => {
        this.inflightRefresh = null;
      });
    }
    return this.inflightRefresh;
  }

  private async doRefresh(): Promise<SubscriptionSnapshot> {
    const record = await this.touchClock();

    if (!this.adapter.isAvailable()) {
      this.verified = false;
      this.isOffline = false;
      return this.publish(record);
    }

    if (!(await this.connectivity.isOnline())) {
      this.verified = false;
      this.isOffline = true;
      return this.publish(record);
    }

    try {
      return await this.applyCustomerInfo(await this.adapter.getCustomerInfo());
    } catch (error) {
      this.verified = false;
      this.isOffline = !(error instanceof RevenueCatError && error.kind === 'not_configured');
      return this.publish(await this.cache.read());
    }
  }

  /**
   * Maps a CustomerInfo to the normalized state, persists it and publishes
   * it. `identity` overrides the cached `revenueCatUserId`: `undefined`
   * (the default) leaves it alone, a string/`null` sets it — used by
   * `identifyUser()`/`clearIdentity()` to record which Invora identity this
   * entitlement was verified under, atomically with the entitlement itself.
   */
  private async applyCustomerInfo(info: CustomerInfoLike, identity?: string | null): Promise<SubscriptionSnapshot> {
    const now = this.now();
    // RevenueCat's own timestamp is the trusted clock. If it's far from the
    // device clock this answer came from the SDK's offline cache (or the
    // device clock is wrong): still usable, but not "verified just now".
    const serverNow = info.requestDateMillis ?? now;
    const fresh = Math.abs(now - serverNow) <= FRESH_TOLERANCE_MS;
    const normalized = normalizeCustomerInfo(info, serverNow);

    const record = await this.cache.update((current) => ({
      ...normalized,
      // A fresh answer also heals a high-water mark poisoned by a clock that was once set far ahead.
      clockHighWaterMs: fresh ? serverNow : Math.max(current.clockHighWaterMs, now),
      usage: current.usage,
      revenueCatUserId: identity === undefined ? current.revenueCatUserId : identity,
    }));

    this.verified = fresh;
    this.isOffline = !fresh;
    this.managementUrl = info.managementURL ?? null;
    return this.publish(record);
  }

  /** Loads (and caches in memory) the purchasable packages. Rejects with `RevenueCatError` when they can't be loaded. */
  async getOfferings(force = false): Promise<StorePackage[]> {
    if (!force && this.offerings) {
      return this.offerings;
    }
    if (!this.adapter.isAvailable()) {
      throw new RevenueCatError('not_configured', 'In-app subscriptions are not available in this build.');
    }
    this.offerings = await this.adapter.getOfferings();
    return this.offerings;
  }

  async purchase(plan: PaidPlanId, period: BillingPeriod): Promise<PurchaseOutcome> {
    if (!this.adapter.isAvailable()) {
      return { status: 'unavailable' };
    }
    const product = PLAN_CONFIG[plan].products?.[period];
    if (!product) {
      return { status: 'product_unavailable' };
    }

    const current = this.snapshot;
    const currentRef = {
      plan: current.plan,
      period: current.subscription.billingPeriod,
    };
    // Real store prices when offerings are loaded (see `planChangeKind`'s doc
    // comment) — falls back to the reference USD price when they aren't.
    const currentPackage = isPaidPlan(current.plan)
      ? this.offerings?.find((pkg) => pkg.plan === current.plan && pkg.period === currentRef.period) ?? null
      : null;
    const targetPackage = this.offerings?.find((pkg) => pkg.plan === plan && pkg.period === period) ?? null;
    const kind: PlanChangeKind = planChangeKind(currentRef, { plan, period }, {
      current: currentPackage,
      target: targetPackage,
    });
    if (kind === 'same') {
      return { status: 'already_subscribed', snapshot: current };
    }
    if (!(await this.connectivity.isOnline())) {
      return { status: 'network_error' };
    }

    // Switching between Play subscriptions must replace the old one, or the
    // user would end up paying for two. `metriqo_<plan>` is the Play
    // subscription id shared by both of that plan's base plans.
    let change: ProductChange | undefined;
    if ((kind === 'immediate' || kind === 'deferred') && isPaidPlan(current.plan)) {
      change = {
        oldProductIdentifier: PLAN_CONFIG[current.plan].products!.monthly.storeProductId,
        timing: kind,
      };
    }

    try {
      const info = await this.adapter.purchase(product.packageId, change);
      const snapshot = await this.applyCustomerInfo(info);
      if (kind === 'deferred') {
        // Google Play accepted the change; the current plan continues until renewal.
        return { status: 'scheduled', snapshot };
      }
      const confirmed = snapshot.subscription.isActive && planRank(snapshot.subscription.plan) >= planRank(plan);
      // Never report success on the strength of the store call alone.
      return confirmed ? { status: 'success', snapshot } : { status: 'pending' };
    } catch (error) {
      return this.purchaseFailure(error);
    }
  }

  private async purchaseFailure(error: unknown): Promise<PurchaseOutcome> {
    if (!(error instanceof RevenueCatError)) {
      return { status: 'failed', message: error instanceof Error ? error.message : 'The purchase could not be completed.' };
    }
    switch (error.kind) {
      case 'cancelled':
        return { status: 'cancelled' };
      case 'network':
        return { status: 'network_error' };
      case 'store_unavailable':
        return { status: 'store_unavailable' };
      case 'product_unavailable':
        return { status: 'product_unavailable' };
      case 'pending':
        return { status: 'pending' };
      case 'not_configured':
        return { status: 'unavailable' };
      case 'already_purchased': {
        const snapshot = await this.refresh('screen');
        return { status: 'already_subscribed', snapshot };
      }
      default:
        return { status: 'failed', message: error.message };
    }
  }

  async restore(): Promise<RestoreOutcome> {
    if (!this.adapter.isAvailable()) {
      return { status: 'unavailable' };
    }
    if (!(await this.connectivity.isOnline())) {
      return { status: 'network_error' };
    }
    const before = this.snapshot.subscription;
    try {
      const snapshot = await this.applyCustomerInfo(await this.adapter.restore());
      if (!snapshot.subscription.isActive) {
        return { status: 'nothing_to_restore', snapshot };
      }
      if (before.isActive && before.plan === snapshot.subscription.plan) {
        return { status: 'already_active', snapshot };
      }
      return { status: 'restored', snapshot };
    } catch (error) {
      if (error instanceof RevenueCatError) {
        if (error.kind === 'network') return { status: 'network_error' };
        if (error.kind === 'store_unavailable') return { status: 'store_unavailable' };
        if (error.kind === 'not_configured') return { status: 'unavailable' };
      }
      return { status: 'failed', message: error instanceof Error ? error.message : 'Purchases could not be restored.' };
    }
  }

  /**
   * Presents RevenueCat's hosted Paywall UI (the multi-tier paywall built in
   * the RevenueCat dashboard for the `default` Offering — this doesn't pick a
   * plan, the paywall does). `'purchased'`/`'restored'` are trusted as-is:
   * unlike `purchase()`, the SDK's own paywall already confirmed the
   * entitlement before resolving, so no extra "did it really activate?"
   * check is needed.
   */
  async presentPaywall(): Promise<PaywallOutcome> {
    if (!this.adapter.isAvailable()) {
      return { status: 'unavailable' };
    }
    try {
      const result = await this.adapter.presentPaywall();
      if (result === 'purchased' || result === 'restored') {
        const snapshot = await this.refresh('screen');
        return { status: result, snapshot };
      }
      if (result === 'error') {
        return { status: 'failed', message: 'The paywall could not be shown.' };
      }
      return { status: result };
    } catch (error) {
      if (error instanceof RevenueCatError && error.kind === 'not_configured') {
        return { status: 'unavailable' };
      }
      return { status: 'failed', message: error instanceof Error ? error.message : 'The paywall could not be shown.' };
    }
  }

  /**
   * Presents RevenueCat's hosted Customer Center (manage/cancel/get help).
   * Any change made inside it also reaches `startListening()`'s
   * `addCustomerInfoListener`, but this refreshes explicitly too so the
   * snapshot is current the moment the caller resumes, without waiting on
   * that push.
   */
  async presentCustomerCenter(): Promise<CustomerCenterOutcome> {
    if (!this.adapter.isAvailable()) {
      return { status: 'unavailable' };
    }
    try {
      await this.adapter.presentCustomerCenter();
      await this.refresh('screen');
      return { status: 'shown' };
    } catch (error) {
      if (error instanceof RevenueCatError && error.kind === 'not_configured') {
        return { status: 'unavailable' };
      }
      return { status: 'failed', message: error instanceof Error ? error.message : 'Could not open support options.' };
    }
  }

  /**
   * Switches RevenueCat to Invora's own stable `local_user_id` (see
   * `db/schema.ts`'s `user_identity` doc comment for why it's never
   * RevenueCat's anonymous id). Safe to call on every startup — it no-ops
   * once already identified as this id (tracked via the cache's
   * `revenueCatUserId`), so the RevenueCat call itself only ever happens once
   * per identity change.
   *
   * A guest's very first identify is always safe: `localUserId` is a freshly
   * generated id RevenueCat has never seen, and RevenueCat's `logIn()`
   * automatically aliases a never-seen-before id to the current session,
   * carrying over any existing (e.g. anonymous) purchase history — no manual
   * restore needed. The one case that does *not* merge is logging in to an id
   * that already has its own separate RevenueCat history (e.g. a Google
   * account previously used to purchase on another device); RevenueCat
   * returns that id's own record instead. A plain guest identify never hits
   * that case — it's Phase B's (Google-account linking) concern.
   */
  async identifyUser(localUserId: string): Promise<IdentifyOutcome> {
    if (!this.adapter.isAvailable()) {
      return { status: 'unavailable' };
    }
    const cached = await this.cache.read();
    if (cached.revenueCatUserId === localUserId) {
      return { status: 'already_identified', snapshot: this.snapshot };
    }
    if (!(await this.connectivity.isOnline())) {
      return { status: 'network_error' };
    }
    try {
      const info = await this.adapter.logIn(localUserId);
      const snapshot = await this.applyCustomerInfo(info, localUserId);
      return { status: 'identified', snapshot };
    } catch (error) {
      if (error instanceof RevenueCatError) {
        if (error.kind === 'network') return { status: 'network_error' };
        if (error.kind === 'not_configured') return { status: 'unavailable' };
      }
      return {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Could not identify this account.',
      };
    }
  }

  /** Returns RevenueCat to anonymous (e.g. an explicit Google sign-out). Best-effort: never throws. */
  async clearIdentity(): Promise<void> {
    if (!this.adapter.isAvailable()) {
      return;
    }
    try {
      const info = await this.adapter.logOut();
      await this.applyCustomerInfo(info, null);
    } catch {
      // Fail-safe, matches startListening()'s pattern — the cache keeps whatever was last verified.
    }
  }

  /**
   * Starts the background refresh triggers that don't depend on a screen:
   * RevenueCat pushing a CustomerInfo update (renewal, cancellation, refund,
   * a purchase made elsewhere) and connectivity returning. Returns a stop function.
   */
  startListening(): () => void {
    const stopInfo = this.adapter.addCustomerInfoListener((info) => {
      this.applyCustomerInfo(info).catch(() => undefined);
    });
    const stopNetwork = this.connectivity.subscribe((online) => {
      if (online) {
        this.refresh('connectivity').catch(() => undefined);
      } else {
        this.verified = false;
        this.isOffline = true;
        this.publish(this.record);
      }
    });
    return () => {
      stopInfo();
      stopNetwork();
    };
  }
}
