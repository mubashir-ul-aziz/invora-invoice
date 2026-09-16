import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessSettings'>;

/**
 * Settings hub: routes into the business profile editor and invoice
 * settings. This was always a pure navigation index (4 `SettingsRow`
 * entries, no fields of its own, no store) — confirmed by inspecting the
 * screen and its one existing test before restyling, per this app's "never
 * fake a backend feature" rule.
 *
 * The Stitch "Business Settings" mock, by contrast, shows three full groups
 * of preferences (active-status/tax-inclusive-pricing toggles, fiscal year,
 * timezone/date format, auto receipts, SMS reminders, biometric auth,
 * data export, account archival). **None of these exist anywhere in this
 * app** — no notifications store, no regional-units settings, no biometric
 * toggle, no export/archive capability. Rather than silently drop the whole
 * design or silently invent a fake settings store, every one of those rows
 * is rendered exactly as designed but is interactive-only-where-harmless
 * and clearly marked "DESIGN ONLY" (per DESIGN.md's rule for a Stitch
 * setting with no existing backend support), while the screen's real
 * functionality — the four navigation rows — stays fully wired at the top.
 * "Default Payment Terms" is the one exception: that setting genuinely
 * exists (`InvoiceSettings.defaultPaymentTermsDays`), so its row is real
 * navigation to Invoice Settings rather than a DESIGN ONLY placeholder.
 */
export function BusinessSettingsScreen({ navigation }: Props) {
  const [activeStatus, setActiveStatus] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [autoReceipts, setAutoReceipts] = useState(true);
  const [smsReminders, setSmsReminders] = useState(true);
  const [biometricAuth, setBiometricAuth] = useState(true);

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="business-settings-screen"
    >
      {/* Real navigation index */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <View style={styles.linkCard}>
          <SettingsRow
            icon="briefcase"
            label="Business profile"
            description="Name, logo, address, contact details, invoice prefix"
            onPress={() => navigation.navigate('EditBusiness')}
            testID="settings-row-profile"
          />
          <SettingsRow
            icon="file-text"
            label="Invoice settings"
            description="Prefix, numbering, currency, default tax, template"
            onPress={() => navigation.navigate('InvoiceSettings')}
            testID="settings-row-invoice"
          />
          <SettingsRow
            icon="layers"
            label="Invoice type"
            description="Which fields appear on an invoice line item"
            onPress={() => navigation.navigate('InvoiceTypeSelection')}
            testID="settings-row-invoice-type"
          />
          <SettingsRow
            icon="credit-card"
            label="Digital business card"
            description="Card, QR code, sharing"
            onPress={() => navigation.navigate('DigitalCard')}
            testID="settings-row-card"
            tag="vCard"
          />
        </View>
      </View>

      {/* General Preferences — DESIGN ONLY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General Preferences · DESIGN ONLY</Text>
        <View style={styles.card}>
          <FieldToggleRow
            icon="check-circle"
            label="Business Active Status"
            description="Show business publicly on directory & invoices"
            checked={activeStatus}
            onToggle={() => setActiveStatus((v) => !v)}
            testID="toggle-active-status-design-only"
          />
          <View style={styles.divider} />
          <FieldToggleRow
            icon="percent"
            label="Tax Inclusive Pricing"
            description="Show item rates including VAT by default"
            checked={taxInclusive}
            onToggle={() => setTaxInclusive((v) => !v)}
            testID="toggle-tax-inclusive-design-only"
          />
          <View style={styles.divider} />
          <ValueRow
            icon="repeat"
            label="Fiscal Year End"
            value="31 March"
            onPress={() => notAvailable('Fiscal year end')}
            testID="action-fiscal-year-design-only"
          />
          <View style={styles.divider} />
          <ValueRow
            icon="clock"
            label="Timezone & Format"
            value="Not configurable"
            onPress={() => notAvailable('Timezone & date format')}
            testID="action-timezone-design-only"
          />
        </View>
      </View>

      {/* Client & Billing Automation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client &amp; Billing Automation</Text>
        <View style={styles.card}>
          {/* DESIGN ONLY: no notifications capability exists anywhere in this app. */}
          <FieldToggleRow
            icon="mail"
            label="Auto Payment Receipts · DESIGN ONLY"
            description="Email confirmation instantly on paid balance"
            checked={autoReceipts}
            onToggle={() => setAutoReceipts((v) => !v)}
            testID="toggle-auto-receipts-design-only"
          />
          <View style={styles.divider} />
          <FieldToggleRow
            icon="message-square"
            label="SMS Reminders · DESIGN ONLY"
            description="Send a nudge before the due date"
            checked={smsReminders}
            onToggle={() => setSmsReminders((v) => !v)}
            testID="toggle-sms-reminders-design-only"
          />
          <View style={styles.divider} />
          {/* Real — the same setting InvoiceSettingsScreen already edits. */}
          <SettingsRow
            icon="clock"
            label="Default Payment Terms"
            description="Net terms applied to new invoices"
            onPress={() => navigation.navigate('InvoiceSettings')}
            testID="settings-row-payment-terms"
          />
        </View>
      </View>

      {/* Security & Data — DESIGN ONLY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security &amp; Data · DESIGN ONLY</Text>
        <View style={styles.card}>
          <FieldToggleRow
            icon="lock"
            label="Biometric Authorization"
            description="Face ID / Touch ID for sending & payouts"
            checked={biometricAuth}
            onToggle={() => setBiometricAuth((v) => !v)}
            testID="toggle-biometric-design-only"
          />
          <View style={styles.divider} />
          <ValueRow
            icon="download"
            label="Export Ledger & Invoices"
            value="Export"
            onPress={() => notAvailable('CSV/JSON export')}
            testID="action-export-ledger-design-only"
          />
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Archive Business Account — DESIGN ONLY, not implemented"
            testID="action-archive-business-design-only"
            onPress={() => notAvailable('Archiving a business account')}
            style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
          >
            <View style={styles.dangerIcon}>
              <Feather name="alert-triangle" size={18} color={colors.danger} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.dangerLabel}>Archive Business Account</Text>
              <Text style={styles.dangerCaption}>Freeze invoicing and hide from client view</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.valueRow, pressed && styles.pressed]}
    >
      <View style={styles.valueIcon}>
        <Feather name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.valueLabel}>{label}</Text>
      <View style={styles.valueRight}>
        <Text style={styles.valueText}>{value}</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  linkCard: { gap: 8 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  divider: { height: 1, backgroundColor: colors.background, marginHorizontal: 12 },

  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  valueIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  valueLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  valueRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontSize: 12, color: colors.textMuted },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dangerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FBE4E2', alignItems: 'center', justifyContent: 'center' },
  dangerLabel: { fontSize: 14, fontWeight: '600', color: colors.danger },
  dangerCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
