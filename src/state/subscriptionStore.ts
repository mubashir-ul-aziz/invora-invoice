import { create } from 'zustand';

import { getEntitlementService, getIdentityService, getSubscriptionService } from '@/data/container';
import type { IdentityService } from '@/data/identity/IdentityService';
import type { EntitlementService } from '@/data/subscription/EntitlementService';
import type { StorePackage } from '@/data/subscription/RevenueCatAdapter';
import type {
  CustomerCenterOutcome,
  PaywallOutcome,
  PurchaseOutcome,
  RestoreOutcome,
  SubscriptionService,
  SyncTrigger,
} from '@/data/subscription/SubscriptionService';
import { openWebsite } from '@/lib/linking';
import type { InvoiceCreationDecision, InvoiceUsage } from '@/domain/subscription/invoiceAccess';
import type { BillingPeriod, PaidPlanId } from '@/domain/subscription/plans';
import { deriveDisplayStatus, type SubscriptionBusyState } from '@/domain/subscription/status';
import { INITIAL_SNAPSHOT, type SubscriptionSnapshot, type SubscriptionStatus } from '@/domain/subscription/types';

export type OfferingsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SubscriptionState {
  /**
   * `false` until the cached subscription has been read once at startup. While
   * unresolved the plan is a placeholder, so access checks treat content as
   * unlocked instead of flashing a paid user's history as locked.
   */
  resolved: boolean;
  snapshot: SubscriptionSnapshot;
  /** What the UI shows: the snapshot's status with transient overlays (loading/restoring/pending). */
  displayStatus: SubscriptionStatus;
  busy: SubscriptionBusyState;
  purchasing: boolean;
  /** A purchase was started but the store hasn't confirmed it; nothing is unlocked until it does. */
  purchasePending: boolean;
  /** RevenueCat's Customer Center is currently on screen. */
  presentingCustomerCenter: boolean;
  packages: StorePackage[];
  offeringsStatus: OfferingsStatus;
  offeringsError: string | null;
  /** Last known invoice usage; null until first loaded. */
  usage: InvoiceUsage | null;

  /** Reads the cache, starts background listeners, then syncs with RevenueCat. Safe to call once at startup. */
  init: () => Promise<void>;
  /** Refreshes from RevenueCat (startup, foreground, connectivity, opening the pricing screen). Never throws. */
  refresh: (trigger?: SyncTrigger) => Promise<void>;
  refreshUsage: () => Promise<void>;
  /** A fresh, authoritative "may the user create another invoice?" answer (also updates `usage`). */
  checkCanCreateInvoice: () => Promise<InvoiceCreationDecision>;
  loadOfferings: (force?: boolean) => Promise<void>;
  purchase: (plan: PaidPlanId, period: BillingPeriod) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  /** Opens Google Play's subscription management. Resolves false if it couldn't be opened. */
  openManageSubscription: () => Promise<boolean>;
  /** Presents RevenueCat's hosted Paywall UI (the dashboard's multi-tier `default` Offering paywall). */
  presentPaywall: () => Promise<PaywallOutcome>;
  /** Presents RevenueCat's hosted Customer Center (manage/cancel/get help). */
  presentCustomerCenter: () => Promise<CustomerCenterOutcome>;
}

function displayStatusOf(
  snapshot: SubscriptionSnapshot,
  busy: SubscriptionBusyState,
  purchasePending: boolean,
): SubscriptionStatus {
  return deriveDisplayStatus({
    subscription: snapshot.subscription,
    plan: snapshot.plan,
    trust: snapshot.trust,
    isOffline: snapshot.isOffline,
    busy,
    purchasePending,
  });
}

/**
 * The UI-facing subscription store. Thin by design: state + actions that
 * delegate to `SubscriptionService` (RevenueCat/cache) and `EntitlementService`
 * (decisions). Dependencies resolve lazily so tests can inject fakes via
 * `createSubscriptionStore` and importing this module never touches
 * RevenueCat or SQLite.
 */
export function createSubscriptionStore(
  getService: () => SubscriptionService = getSubscriptionService,
  getEntitlement: () => EntitlementService = getEntitlementService,
  openUrl: (url: string) => Promise<boolean> = openWebsite,
  getIdentity: () => IdentityService = getIdentityService,
) {
  let initialized = false;

  return create<SubscriptionState>((set, get) => {
    const apply = (patch: Partial<SubscriptionState>) => {
      const next = { ...get(), ...patch };
      set({ ...patch, displayStatus: displayStatusOf(next.snapshot, next.busy, next.purchasePending) });
    };

    const onSnapshot = (snapshot: SubscriptionSnapshot) => {
      const planChanged = snapshot.plan !== get().snapshot.plan;
      // A pending purchase is settled the moment an active plan actually arrives.
      const purchasePending = get().purchasePending && !snapshot.subscription.isActive;
      apply({ snapshot, purchasePending, resolved: true });
      if (planChanged) {
        // The monthly limit belongs to the plan, so the usage meter must be recomputed for the new one.
        get().refreshUsage();
      }
    };

    return {
      resolved: false,
      snapshot: INITIAL_SNAPSHOT,
      displayStatus: 'LOADING',
      busy: null,
      purchasing: false,
      purchasePending: false,
      presentingCustomerCenter: false,
      packages: [],
      offeringsStatus: 'idle',
      offeringsError: null,
      usage: null,

      init: async () => {
        if (initialized) {
          return;
        }
        initialized = true;
        apply({ busy: 'loading' });
        try {
          const service = getService();
          service.subscribe(onSnapshot);
          service.startListening();
          getEntitlement().onUsageChanged(() => {
            get().refreshUsage();
          });
          await service.loadCached();
        } catch {
          // Couldn't even read the cache (storage error): run as Free rather than block the app.
          apply({ resolved: true, busy: null });
        }
        apply({ resolved: true, busy: null });
        // Best-effort, never blocks startup: creates the guest identity on
        // first launch (no sign-in prompt) and, once, switches RevenueCat to
        // it — see `SubscriptionService.identifyUser()`. Runs before the
        // startup refresh below so that sync already reflects the right
        // identity instead of a stale anonymous one.
        try {
          const identity = await getIdentity().getOrCreateLocalUserId();
          await getService().identifyUser(identity.localUserId);
        } catch {
          // Identity/RevenueCat unavailable: proceed on the cached/Free state, same as every other best-effort step here.
        }
        // Sequential on purpose: usage is computed against the plan, so it must wait for the sync to settle.
        await get().refresh('startup');
        await get().refreshUsage();
      },

      refresh: async (trigger = 'screen') => {
        try {
          await getService().refresh(trigger);
        } catch {
          // The service already falls back to the cached state; nothing to surface here.
        }
      },

      refreshUsage: async () => {
        try {
          apply({ usage: await getEntitlement().getInvoiceUsage() });
        } catch {
          // Leave the last known usage in place; the hard limit check happens at creation time anyway.
        }
      },

      checkCanCreateInvoice: async () => {
        const decision = await getEntitlement().canCreateInvoice();
        apply({ usage: decision.usage });
        return decision;
      },

      loadOfferings: async (force = false) => {
        apply({ offeringsStatus: 'loading', offeringsError: null });
        try {
          const packages = await getService().getOfferings(force);
          apply({ packages, offeringsStatus: 'ready' });
        } catch (error) {
          apply({
            offeringsStatus: 'error',
            offeringsError: error instanceof Error ? error.message : 'Plans could not be loaded.',
          });
        }
      },

      purchase: async (plan, period) => {
        apply({ purchasing: true, purchasePending: false });
        try {
          const outcome = await getService().purchase(plan, period);
          apply({ purchasing: false, purchasePending: outcome.status === 'pending' });
          if (outcome.status === 'success' || outcome.status === 'scheduled') {
            await get().refreshUsage();
          }
          return outcome;
        } catch (error) {
          apply({ purchasing: false });
          return { status: 'failed', message: error instanceof Error ? error.message : 'The purchase could not be completed.' };
        }
      },

      restore: async () => {
        apply({ busy: 'restoring', purchasePending: false });
        try {
          const outcome = await getService().restore();
          apply({ busy: null });
          return outcome;
        } catch (error) {
          apply({ busy: null });
          return { status: 'failed', message: error instanceof Error ? error.message : 'Purchases could not be restored.' };
        }
      },

      openManageSubscription: async () => openUrl(getService().getManagementUrl()),

      presentPaywall: async () => {
        apply({ purchasing: true, purchasePending: false });
        try {
          const outcome = await getService().presentPaywall();
          apply({ purchasing: false });
          if (outcome.status === 'purchased' || outcome.status === 'restored') {
            await get().refreshUsage();
          }
          return outcome;
        } catch (error) {
          apply({ purchasing: false });
          return { status: 'failed', message: error instanceof Error ? error.message : 'The paywall could not be shown.' };
        }
      },

      presentCustomerCenter: async () => {
        apply({ presentingCustomerCenter: true });
        try {
          const outcome = await getService().presentCustomerCenter();
          apply({ presentingCustomerCenter: false });
          return outcome;
        } catch (error) {
          apply({ presentingCustomerCenter: false });
          return { status: 'failed', message: error instanceof Error ? error.message : 'Could not open support options.' };
        }
      },
    };
  });
}

/** App-wide singleton store, wired to the real RevenueCat/SQLite-backed services. */
export const useSubscriptionStore = createSubscriptionStore();
