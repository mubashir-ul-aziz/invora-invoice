import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useSubscriptionStore } from '@/state/subscriptionStore';

interface Props {
  children: React.ReactNode;
}

/**
 * Keeps the subscription fresh without ever gating the app. Wraps the whole
 * tree (see `App.tsx`) purely for its effects, like `AutoBackupRunner`:
 *
 *  - on startup: reads the cached subscription immediately (so Metriqo works
 *    offline on the last known plan), then syncs with RevenueCat;
 *  - every time the app returns to the foreground: syncs again and refreshes
 *    the invoice-usage meter;
 *  - when connectivity returns and when RevenueCat pushes an update: handled
 *    inside `SubscriptionService.startListening()`, started by `init()`.
 *
 * Every step is best-effort and fail-safe: if RevenueCat, Google Play or the
 * network is unavailable, the app keeps running on the cached plan.
 */
export function SubscriptionRunner({ children }: Props) {
  const init = useSubscriptionStore((state) => state.init);
  const refresh = useSubscriptionStore((state) => state.refresh);
  const refreshUsage = useSubscriptionStore((state) => state.refreshUsage);
  const appState = useRef<AppStateStatus>(AppState.currentState);

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

  return <>{children}</>;
}
