import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { EMPTY_SECURITY_SETTINGS_INPUT } from '@/domain/security/types';
import type { RootStackParamList } from '@/navigation/types';
import { useSecurityStore } from '@/state/securityStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Security'>;

const SUCCESS_BG = '#DBFCEC';
const SUCCESS_FG = '#006243';

/**
 * Security (Phase 10) — App Lock and Biometric Unlock. Each toggle saves
 * immediately (no separate "Save" button), the natural convention for a
 * settings switch. Reuses `FieldToggleRow` (Phase 3) instead of adding a new
 * `Switch`-based component, per the same "no unnecessary packages" reasoning
 * `OptionPicker`/`FieldToggleRow` already established.
 *
 * `AppLockGate` (the runtime enforcement of these settings) reads this same
 * `securityStore` singleton — see its doc comment.
 *
 * Restyled to match the Stitch "Security" design's status-banner + grouped
 * cards. The banner's "Protected" state is now computed from the real
 * `appLockEnabled`/`biometricUnlockEnabled` values instead of Stitch's
 * fabricated "Verified 12m ago on iPhone 15 Pro" (no device/session/
 * verification-timestamp data exists anywhere in this app, so that claim
 * is dropped rather than shown). The App Lock and Biometric Unlock rows
 * stay real, wired to `securityStore`/`expo-local-authentication` exactly
 * as before.
 *
 * Everything else Stitch shows — Lock Timeout, Sensitive Action
 * Confirmation, Change 6-Digit Passcode, Active Device Sessions, and
 * Two-Factor Authentication — has no backing feature anywhere in this app
 * (no timeout setting, no in-app passcode distinct from the OS one, no
 * session tracking, no 2FA). Per this app's "never fake a backend
 * feature" rule, each is rendered as designed but is DESIGN ONLY:
 * interactive only where harmless (in-memory only, never persisted) and
 * clearly labeled. Stitch's fabricated specifics within those rows (the
 * "45 days ago" passcode-change date, the "iPhone 15 Pro • London, UK"
 * session, the "SMS & Authenticator App (Enabled)" 2FA badge) are dropped
 * rather than shown, since they're false claims about data that doesn't
 * exist — same precedent as Business Settings and Invoice Review. The
 * footer's "256-bit hardware-backed... Secure Enclave" encryption claim is
 * dropped entirely for the same reason.
 */
export function SecurityScreen(_props: Props) {
  const { status, settings, biometricSupported, error, load, save } = useSecurityStore();

  const [lockTimeout, setLockTimeout] = useState('Immediately');
  const [sensitiveConfirm, setSensitiveConfirm] = useState(true);

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
  const protectedState = current.appLockEnabled;

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

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  const showTimeoutPicker = () => {
    Alert.alert(
      'Lock Timeout — DESIGN ONLY',
      'This setting is not implemented yet. Choose an option to preview the design.',
      [
        { text: 'Immediately', onPress: () => setLockTimeout('Immediately') },
        { text: 'After 1 minute', onPress: () => setLockTimeout('After 1 minute') },
        { text: 'After 5 minutes', onPress: () => setLockTimeout('After 5 minutes') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="security-screen">
      {/* Real status banner — computed from actual App Lock / Biometric state */}
      <View style={styles.banner} testID="security-status-banner">
        <View style={[styles.bannerIcon, !protectedState && styles.bannerIconOff]}>
          <Feather name="shield" size={20} color={protectedState ? SUCCESS_FG : colors.textMuted} />
        </View>
        <View style={styles.flexShrink}>
          <View style={styles.bannerBadgeRow}>
            <View style={[styles.bannerBadge, !protectedState && styles.bannerBadgeOff]}>
              <Text style={[styles.bannerBadgeText, !protectedState && styles.bannerBadgeTextOff]}>
                {protectedState ? 'Protected' : 'Not protected'}
              </Text>
            </View>
          </View>
          <Text style={styles.bannerCaption}>
            {protectedState
              ? current.biometricUnlockEnabled
                ? 'App Lock and biometric unlock are on'
                : 'App Lock is on'
              : 'Turn on App Lock below to protect this app'}
          </Text>
        </View>
      </View>

      <Section title="Access Control">
        <FieldToggleRow
          icon="lock"
          label="App Lock"
          description="Require authentication to open Invora"
          checked={current.appLockEnabled}
          onToggle={() => persist({ ...current, appLockEnabled: !current.appLockEnabled })}
          testID="toggle-app-lock"
        />
        {current.appLockEnabled && (
          <ValueRow
            icon="clock"
            label="Lock Timeout · DESIGN ONLY"
            value={lockTimeout}
            onPress={showTimeoutPicker}
            testID="action-lock-timeout-design-only"
          />
        )}
        <FieldToggleRow
          icon="smartphone"
          label="Biometric Unlock (Face ID)"
          description="Use Face ID / fingerprint in addition to your passcode"
          checked={current.biometricUnlockEnabled}
          disabled={!biometricSupported}
          disabledHint="Not supported on this device"
          onToggle={() =>
            persist({ ...current, biometricUnlockEnabled: !current.biometricUnlockEnabled })
          }
          testID="toggle-biometric-unlock"
        />
      </Section>

      {/* DESIGN ONLY: no separate "sensitive action confirmation" or in-app passcode feature exists. */}
      <Section title="Transaction Security · DESIGN ONLY">
        <FieldToggleRow
          icon="save"
          label="Sensitive Action Confirmation"
          description="Confirm before deleting customers or voiding invoices"
          checked={sensitiveConfirm}
          onToggle={() => setSensitiveConfirm((v) => !v)}
          testID="toggle-sensitive-confirm-design-only"
        />
        <ValueRow
          icon="hash"
          label="Change 6-Digit Passcode"
          value="Change"
          onPress={() => notAvailable('A separate in-app passcode')}
          testID="action-change-passcode-design-only"
        />
      </Section>

      {/* DESIGN ONLY: no session tracking or 2FA exists anywhere in this app. */}
      <Section title="Audit & Recovery · DESIGN ONLY">
        <ValueRow
          icon="smartphone"
          label="Active Device Sessions"
          value=""
          onPress={() => notAvailable('Device session tracking')}
          testID="action-device-sessions-design-only"
        />
        <ValueRow
          icon="shield"
          label="Two-Factor Authentication"
          value=""
          onPress={() => notAvailable('Two-factor authentication')}
          testID="action-two-factor-design-only"
        />
      </Section>

      {status === 'saving' && <ActivityIndicator color={colors.primary} testID="security-saving" />}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ValueRow({
  icon,
  label,
  value,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} — DESIGN ONLY, not implemented`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.valueRow, pressed && styles.pressed]}
    >
      <View style={styles.valueIcon}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.valueLabel}>{label}</Text>
      <View style={styles.valueRight}>
        {!!value && <Text style={styles.valueText}>{value}</Text>}
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: SUCCESS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconOff: { backgroundColor: colors.background },
  bannerBadgeRow: { flexDirection: 'row' },
  bannerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: SUCCESS_BG,
  },
  bannerBadgeOff: { backgroundColor: colors.background },
  bannerBadgeText: { fontSize: 11, fontWeight: '700', color: SUCCESS_FG },
  bannerBadgeTextOff: { color: colors.textMuted },
  bannerCaption: { fontSize: 12, color: colors.textMuted, marginTop: 5 },

  section: { gap: 8 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 2,
  },
  sectionCard: {
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  valueIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  valueLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  valueRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontSize: 12, color: colors.textMuted },
});
