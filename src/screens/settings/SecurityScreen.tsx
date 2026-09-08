import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { EMPTY_SECURITY_SETTINGS_INPUT } from '@/domain/security/types';
import type { RootStackParamList } from '@/navigation/types';
import { useSecurityStore } from '@/state/securityStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Security'>;

/**
 * Security (Phase 10) — App Lock and Biometric Unlock. Each toggle saves
 * immediately (no separate "Save" button), the natural convention for a
 * settings switch. Reuses `FieldToggleRow` (Phase 3) instead of adding a new
 * `Switch`-based component, per the same "no unnecessary packages" reasoning
 * `OptionPicker`/`FieldToggleRow` already established.
 *
 * `AppLockGate` (the runtime enforcement of these settings) reads this same
 * `securityStore` singleton — see its doc comment.
 */
export function SecurityScreen(_props: Props) {
  const { status, settings, biometricSupported, error, load, save } = useSecurityStore();

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="security-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="security-error">
        <Text style={styles.errorText}>Couldn't load your security settings.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const current = settings ?? { ...EMPTY_SECURITY_SETTINGS_INPUT };

  const persist = async (next: typeof current) => {
    try {
      await save(next);
    } catch {
      Alert.alert(
        "Couldn't save",
        'Your security settings could not be saved. Please try again.',
      );
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="security-screen">
      <Text style={styles.hint}>
        When App Lock is on, Invora requires your device's biometric or passcode authentication to
        open, and again whenever you return to it after switching to another app.
      </Text>

      <FieldToggleRow
        label="App Lock"
        checked={current.appLockEnabled}
        onToggle={() => persist({ ...current, appLockEnabled: !current.appLockEnabled })}
        testID="toggle-app-lock"
      />

      <FieldToggleRow
        label="Biometric unlock"
        checked={current.biometricUnlockEnabled}
        disabled={!biometricSupported}
        disabledHint="Not supported on this device"
        onToggle={() =>
          persist({ ...current, biometricUnlockEnabled: !current.biometricUnlockEnabled })
        }
        testID="toggle-biometric-unlock"
      />
      <Text style={styles.hint}>
        Uses Face ID / fingerprint (when your device supports it) in addition to your device
        passcode. Only takes effect while App Lock is on.
      </Text>

      {status === 'saving' && <ActivityIndicator color={colors.primary} testID="security-saving" />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textMuted },
});
