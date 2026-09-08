import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useBackupStore } from '@/state/backupStore';

interface Props {
  children: React.ReactNode;
}

/**
 * The "Automatic backup" feature's only runtime hook. Wraps the whole app
 * (see `App.tsx`) purely for its effects — it never gates or delays
 * rendering `children`, unlike `AppLockGate`.
 *
 * **This is not a true OS background job.** Expo's managed workflow has no
 * always-on background-fetch guarantee reliable enough to promise "backs up
 * every day even if you never open the app" without adding
 * `expo-task-manager`/`expo-background-fetch` and a native/EAS build this
 * environment has no device to verify — see "Known limitations" in
 * `IMPLEMENTATION_STATUS.md`. Instead, `backupStore.runAutomaticBackupIfDue()`
 * is called opportunistically: once when the app finishes loading its
 * backup settings, and again every time the app returns to the foreground —
 * the same trigger points `AppLockGate` already uses for its own check. If
 * the toggle is off, the user isn't signed in, or a backup already ran
 * recently, the call is a fast no-op.
 */
export function AutoBackupRunner({ children }: Props) {
  const { status, load, runAutomaticBackupIfDue } = useBackupStore();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status === 'ready') {
      runAutomaticBackupIfDue();
    }
  }, [status, runAutomaticBackupIfDue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (/inactive|background/.test(appState.current) && nextState === 'active') {
        runAutomaticBackupIfDue();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [runAutomaticBackupIfDue]);

  return <>{children}</>;
}
