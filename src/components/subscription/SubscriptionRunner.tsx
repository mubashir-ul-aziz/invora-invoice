import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { planStatusChangeMessage } from '@/screens/subscription/outcomeMessages';
import { useSubscriptionStore } from '@/state/subscriptionStore';
import { toast } from '@/state/toastStore';

interface Props {
  children: React.ReactNode;
}

/** Re-check this long after the expiry, giving RevenueCat a moment to record the renewal. */
const EXPIRY_SETTLE_MS = 10 * 1000;
/** After an expiry, keep re-checking for this long — a store renewal can reach RevenueCat a few minutes late. */
const LAPSE_WATCH_MS = 10 * 60 * 1000;
const LAPSE_POLL_MS = 60 * 1000;
/** Expiries further out than this are left to the foreground/startup syncs (and stay under setTimeout's limit). */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps the subscription fresh without ever gating the app. Wraps the whole
 * tree (see `App.tsx`) purely for its effects, like `AutoBackupRunner`:
 *
 *  - on startup: reads the cached subscription immediately (so Metriqo works
 *    offline on the last known plan), then syncs with RevenueCat;
 *  - every time the app returns to the foreground: syncs again and refreshes
 *    the invoice-usage meter;
 *  - when the entitlement's expiry passes while the app is open: syncs right
 *    after it, then every minute for a few minutes, so a renewal isn't shown
 *    as "Expired" until the next app restart;
 *  - when connectivity returns and when RevenueCat pushes an update: handled
 *    inside `SubscriptionService.startListening()`, started by `init()`;
 *  - when any of those syncs reports that the plan was cancelled (or the
 *    cancellation undone): shows a toast, since that happens outside the app.
 *
 * Every step is best-effort and fail-safe: if RevenueCat, Google Play or the
 * network is unavailable, the app keeps running on the cached plan.
 */
export function SubscriptionRunner({ children }: Props) {
  const init = useSubscriptionStore((state) => state.init);
  const refresh = useSubscriptionStore((state) => state.refresh);
  const refreshUsage = useSubscriptionStore((state) => state.refreshUsage);
  const expiresAt = useSubscriptionStore((state) => state.snapshot.subscription.expiresAt);
  const isActive = useSubscriptionStore((state) => state.snapshot.subscription.isActive);
  const currentSubscription = useSubscriptionStore((state) => state.snapshot.subscription);
  const previousSubscription = useRef(currentSubscription);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [expiryTick, setExpiryTick] = useState(0);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (/inactive|background/.test(appState.current) && nextState === 'active') {
        refresh('foreground');
        refreshUsage();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [refresh, refreshUsage]);

  useEffect(() => {
    if (expiresAt === null) return;
    const sinceExpiry = Date.now() - expiresAt;
    let delay: number;
    if (sinceExpiry < 0) {
      delay = -sinceExpiry + EXPIRY_SETTLE_MS;
    } else if (sinceExpiry < LAPSE_WATCH_MS) {
      delay = LAPSE_POLL_MS;
    } else {
      return;
    }
    if (delay > MAX_TIMER_MS) return;
    const timer = setTimeout(() => {
      // In the background the foreground sync covers it on return.
      if (AppState.currentState === 'active') {
        refresh('expiry').finally(() => setExpiryTick((tick) => tick + 1));
      } else {
        setExpiryTick((tick) => tick + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [expiresAt, isActive, expiryTick, refresh]);

  useEffect(() => {
    const message = planStatusChangeMessage(previousSubscription.current, currentSubscription);
    previousSubscription.current = currentSubscription;
    if (message) {
      toast.show(message.type, message);
    }
  }, [currentSubscription]);

  return <>{children}</>;
}
