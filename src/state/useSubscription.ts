import { useCallback } from 'react';

import { canAccessHistoricalCustomer, canUsePricingMethod } from '@/domain/subscription/customerAccess';
import {
  createdAtToMs,
  getInvoiceAccess,
  type InvoiceAccess,
} from '@/domain/subscription/invoiceAccess';
import { effectiveNow } from '@/domain/subscription/offlinePolicy';
import { getPlanConfig, isPaidPlan } from '@/domain/subscription/plans';
import type { UpgradeReason } from '@/domain/subscription/upgradeReason';

import { useSubscriptionStore } from './subscriptionStore';

/** The slice of a navigation prop the creation guard needs. */
interface PricingNavigation {
  navigate: (screen: 'Pricing', params: { reason: UpgradeReason }) => void;
}

/**
 * The one hook screens use to ask "is the user allowed to…?" and to read the
 * subscription. Screens never look at a plan name — they call these
 * predicates, which are backed by `PLAN_CONFIG` and the pure rules in
 * `domain/subscription`. Until the cached plan has been read once at startup
 * (`resolved`), content is treated as unlocked so a paid user never sees
 * their history flash as locked.
 */
export function useSubscription() {
  const state = useSubscriptionStore();
  const { resolved, snapshot, usage } = state;
  const plan = snapshot.plan;

  const currentTime = () => effectiveNow(Date.now(), snapshot.clockHighWaterMs);

  /** Whether an invoice created at `createdAt` may be opened right now (and when that ends, for Free). */
  const getInvoiceAccessFor = useCallback(
    (createdAt: string | number): InvoiceAccess => {
      if (!resolved) {
        return { accessible: true, accessEndsAt: null };
      }
      return getInvoiceAccess(plan, createdAtToMs(createdAt), effectiveNow(Date.now(), snapshot.clockHighWaterMs));
    },
    [resolved, plan, snapshot.clockHighWaterMs],
  );

  const canAccessHistoricalInvoice = useCallback(
    (createdAt: string | number) => getInvoiceAccessFor(createdAt).accessible,
    [getInvoiceAccessFor],
  );

  // A usage reading from before the month rolled over no longer applies.
  const usageIsCurrent = !!usage && currentTime() < usage.resetsAt;
  const atInvoiceLimit = !!usage && usageIsCurrent && usage.limit !== null && usage.used >= usage.limit;

  /**
   * Early, synchronous feedback for the "new invoice" entry points: if the
   * last known usage is already at the limit, block instead of starting a
   * flow the user can't finish. This is UX only — the real limit is enforced
   * when the invoice is saved (`invoiceStore.create`).
   *
   * By default this navigates straight to Pricing (unchanged behavior). Pass
   * `onBlocked` to show the `InvoiceLimitModal` in place instead — the
   * caller decides how to present the block, the hook only decides whether
   * to block, from the same `atInvoiceLimit` every screen already reads.
   * Returns whether `proceed` ran.
   */
  const guardInvoiceCreation = useCallback(
    (navigation: PricingNavigation, proceed: () => void, onBlocked?: () => void): boolean => {
      if (atInvoiceLimit) {
        if (onBlocked) {
          onBlocked();
        } else {
          navigation.navigate('Pricing', { reason: 'invoice_limit' });
        }
        return false;
      }
      proceed();
      return true;
    },
    [atInvoiceLimit],
  );

  return {
    /** False until the cached subscription has been read once at startup. */
    resolved,
    plan,
    planConfig: getPlanConfig(plan),
    isPaid: isPaidPlan(plan),
    status: state.displayStatus,
    subscription: snapshot.subscription,
    trust: snapshot.trust,
    isOffline: snapshot.isOffline,
    usage,
    atInvoiceLimit,
    packages: state.packages,
    offeringsStatus: state.offeringsStatus,
    offeringsError: state.offeringsError,
    purchasing: state.purchasing,
    purchasePending: state.purchasePending,

    // --- decisions -------------------------------------------------------
    canCreateInvoice: state.checkCanCreateInvoice,
    guardInvoiceCreation,
    getInvoiceAccess: getInvoiceAccessFor,
    canAccessHistoricalInvoice,
    canAccessHistoricalCustomer: () => !resolved || canAccessHistoricalCustomer(plan),
    canUsePricingMethod: (pricingMethodId: string) => canUsePricingMethod(plan, pricingMethodId),
    currentTime,

    // --- actions ---------------------------------------------------------
    refresh: state.refresh,
    refreshUsage: state.refreshUsage,
    loadOfferings: state.loadOfferings,
    purchase: state.purchase,
    restore: state.restore,
    openManageSubscription: state.openManageSubscription,
  };
}
