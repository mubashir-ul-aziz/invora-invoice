import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/**
 * Settings hub (Phase 10) — the top-level entry point `MVP_BUILD_PLAN.md`
 * §7 describes. Grouped exactly as the brief lists them (Business, Invoice,
 * Backup, Security, Account); most rows route into screens Phases 1–3
 * already built (per "use the existing architecture" / "reuse over
 * near-duplicate screens") rather than re-implementing their forms here.
 *
 * The Invoice section deliberately lists all six items the brief names
 * (Invoice Type, Invoice Numbering, Currency, Tax, Payment Terms, Invoice
 * Template) as separate rows even though four of them (Numbering/Currency/
 * Tax/Payment Terms) land on the same `InvoiceSettings` form — that form
 * already edits all four together, so four near-duplicate single-field
 * screens would violate "no duplicate models/screens" for no real benefit;
 * every field the brief names is still one tap away.
 *
 * The Backup row (Phase 11) now routes to a real `BackupScreen` — Google
 * Drive sign-in, Automatic Backup, Backup Now, and a link into
 * `BackupHistoryScreen` — instead of the "coming in a future update" alert
 * Phase 10 shipped in its place. The Cloud Backup row (Phase 12) is a
 * second, independent destination alongside it — see `CloudBackupScreen`.
 */
export function SettingsScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="settings-screen">
      <Text style={styles.sectionHeader}>Business</Text>
      <SettingsRow
        label="Business profile"
        description="Name, logo, address, contact details"
        onPress={() => navigation.navigate('EditBusiness')}
        testID="settings-row-business-profile"
      />
      <SettingsRow
        label="Digital business card"
        description="Card, QR code, sharing"
        onPress={() => navigation.navigate('DigitalCard')}
        testID="settings-row-digital-card"
      />

      <Text style={styles.sectionHeader}>Invoice</Text>
      <SettingsRow
        label="Invoice type"
        description="Which fields appear on an invoice line item"
        onPress={() => navigation.navigate('InvoiceTypeSelection')}
        testID="settings-row-invoice-type"
      />
      <SettingsRow
        label="Invoice numbering"
        description="Prefix and next invoice number"
        onPress={() => navigation.navigate('InvoiceSettings')}
        testID="settings-row-invoice-numbering"
      />
      <SettingsRow
        label="Currency"
        description="The currency used on new invoices"
        onPress={() => navigation.navigate('InvoiceSettings')}
        testID="settings-row-currency"
      />
      <SettingsRow
        label="Tax"
        description="Default tax rate applied to new invoices"
        onPress={() => navigation.navigate('InvoiceSettings')}
        testID="settings-row-tax"
      />
      <SettingsRow
        label="Payment terms"
        description="Default due date for new invoices"
        onPress={() => navigation.navigate('InvoiceSettings')}
        testID="settings-row-payment-terms"
      />
      <SettingsRow
        label="Invoice template"
        description="Classic, Modern, or Compact"
        onPress={() => navigation.navigate('InvoiceTemplates')}
        testID="settings-row-invoice-template"
      />

      <Text style={styles.sectionHeader}>Backup</Text>
      <SettingsRow
        label="Backup & restore"
        description="Google Drive backup, automatic backup, and restore"
        onPress={() => navigation.navigate('Backup')}
        testID="settings-row-backup"
      />
      <SettingsRow
        label="Cloud backup"
        description="Optional paid cloud backup, storage usage, and upgrade"
        onPress={() => navigation.navigate('CloudBackup')}
        testID="settings-row-cloud-backup"
      />

      <Text style={styles.sectionHeader}>Security</Text>
      <SettingsRow
        label="Security"
        description="App Lock and biometric unlock"
        onPress={() => navigation.navigate('Security')}
        testID="settings-row-security"
      />

      <Text style={styles.sectionHeader}>Account</Text>
      <SettingsRow
        label="Account"
        description="Account, subscription, and logout"
        onPress={() => navigation.navigate('Account')}
        testID="settings-row-account"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: -2,
  },
});
