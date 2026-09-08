import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { useAppLockStore } from '@/state/appLockStore';
import { useSecurityStore } from '@/state/securityStore';
import { colors } from '@/theme/colors';

interface Props {
  children: React.ReactNode;
}

/**
 * App Lock (Phase 10 — Settings). Wraps the whole app (see `App.tsx`): when
 * App Lock is off (the default — nothing here changes for an existing
 * install), `children` render immediately, same as before this phase. When
 * it's on, this gate shows a full-screen lock prompt instead of `children`
 * until the user authenticates — on first launch, and again every time the
 * app returns to the foreground after being backgrounded.
 *
 * Reads settings through the shared `securityStore` singleton (the same one
 * the Security screen's toggles write to) rather than its own repository
 * read, so a setting change is picked up without this component needing to
 * know about `SecurityRepository` directly — see `appLockStore`'s doc
 * comment for why the runtime lock/unlock state itself lives in a separate,
 * repository-free store.
 */
export function AppLockGate({ children }: Props) {
  const { status, applyInitialState, lockIfEnabled, unlock } = useAppLockStore();
  const {
    status: securityStatus,
    settings,
    biometricSupported,
    load: loadSecuritySettings,
  } = useSecurityStore();

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const autoUnlockAttempted = useRef(false);

  useEffect(() => {
    loadSecuritySettings();
  }, [loadSecuritySettings]);

  useEffect(() => {
    if (securityStatus === 'ready') {
      applyInitialState(settings?.appLockEnabled ?? false);
    }
  }, [securityStatus, settings, applyInitialState]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (/inactive|background/.test(appState.current) && nextState === 'active') {
        lockIfEnabled(settings?.appLockEnabled ?? false);
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [lockIfEnabled, settings]);

  // Auto-attempt biometric authentication the moment the lock screen
  // appears, but only when the user opted into it — otherwise a manual
  // "Unlock" tap is what triggers the OS prompt (see the screen below).
  useEffect(() => {
    if (
      status === 'locked' &&
      !autoUnlockAttempted.current &&
      settings?.biometricUnlockEnabled &&
      biometricSupported
    ) {
      autoUnlockAttempted.current = true;
      unlock();
    }
    if (status === 'unlocked') {
      autoUnlockAttempted.current = false;
    }
  }, [status, settings, biometricSupported, unlock]);

  if (status === 'checking') {
    return (
      <View style={styles.centered} testID="app-lock-checking">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'locked') {
    const canUseBiometric = !!settings?.biometricUnlockEnabled && biometricSupported;
    return (
      <View style={styles.centered} testID="app-lock-screen">
        <Text style={styles.title}>Invora is locked</Text>
        <Text style={styles.subtitle}>
          {canUseBiometric
            ? 'Use Face ID / fingerprint, or your device passcode, to continue.'
            : 'Enter your device passcode to continue.'}
        </Text>
        <ActionButton label="Unlock" variant="primary" onPress={() => unlock()} testID="app-lock-unlock" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
