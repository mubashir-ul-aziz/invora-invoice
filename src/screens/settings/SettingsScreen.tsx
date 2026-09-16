import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import { INVOICE_TEMPLATE_OPTIONS } from '@/domain/business/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
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
 *
 * Restyled to match the Stitch "Settings" design's grouped cards + per-row
 * icons. Two real additions replace fabricated Stitch elements:
 * - The identity header shows the *real* business name/logo
 *   (`businessProfileStore`, tap → Edit Business) instead of Stitch's
 *   invented personal user ("Alex Vance", "Free Plan", an "online sync"
 *   dot) — this app has no user-account/plan-tier concept distinct from
 *   the business itself.
 * - The "Invoice template" row shows the real active template
 *   (`invoiceSettingsStore.settings.defaultInvoiceTemplate`) as its trailing
 *   tag, matching Stitch's "Modern active" badge with real data.
 * The Stitch mock's "Monthly Invoicing Allowance" usage meter, "Reminders"
 * and "Help & Support" rows (no such routes/features exist), and the
 * footer's "UK HMRC & EU VAT Compliant" claim aren't reproduced — dropped
 * rather than badged, same reasoning as Invoice Review's compliance-claim
 * copy. "Export Tax & Audit Bundle" is DESIGN ONLY (no export capability
 * exists anywhere in this app, same as Payment History's Export ledger).
 */
export function SettingsScreen({ navigation }: Props) {
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const { settings, load: loadInvoiceSettings } = useInvoiceSettingsStore();

  useEffect(() => {
    loadProfile();
    loadInvoiceSettings();
  }, [loadProfile, loadInvoiceSettings]);

  const activeTemplateLabel = INVOICE_TEMPLATE_OPTIONS.find(
    (option) => option.value === settings?.defaultInvoiceTemplate,
  )?.label;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="settings-screen">
      {/* Real business identity header */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit business profile"
        testID="settings-identity-header"
        onPress={() => navigation.navigate('EditBusiness')}
        style={({ pressed }) => [styles.identityCard, pressed && styles.pressed]}
      >
        {profile?.logoUri ? (
          <Image source={{ uri: profile.logoUri }} style={styles.identityLogo} />
        ) : (
          <View style={styles.identityLogoPlaceholder}>
            <Text style={styles.identityLogoPlaceholderText}>
              {(profile?.businessName?.trim() || 'Y').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.identityTextCol}>
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.businessName?.trim() || 'Your business name'}
          </Text>
          <Text style={styles.identityCaption}>Tap to edit business profile</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>

      <Section title="Business">
        <SettingsRow
          icon="briefcase"
          label="Business profile"
          description="Name, logo, address, contact details"
          onPress={() => navigation.navigate('EditBusiness')}
          testID="settings-row-business-profile"
        />
        <SettingsRow
          icon="credit-card"
          label="Digital business card"
          description="Card, QR code, sharing"
          onPress={() => navigation.navigate('DigitalCard')}
          testID="settings-row-digital-card"
        />
      </Section>

      <Section title="Invoice">
        <SettingsRow
          icon="sliders"
          label="Invoice type"
          description="Which fields appear on an invoice line item"
          onPress={() => navigation.navigate('InvoiceTypeSelection')}
          testID="settings-row-invoice-type"
        />
        <SettingsRow
          icon="hash"
          label="Invoice numbering"
          description="Prefix and next invoice number"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-invoice-numbering"
        />
        <SettingsRow
          icon="dollar-sign"
          label="Currency"
          description="The currency used on new invoices"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-currency"
        />
        <SettingsRow
          icon="percent"
          label="Tax"
          description="Default tax rate applied to new invoices"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-tax"
        />
        <SettingsRow
          icon="clock"
          label="Payment terms"
          description="Default due date for new invoices"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-payment-terms"
        />
        <SettingsRow
          icon="grid"
          label="Invoice template"
          description="Classic, Modern, or Compact"
          onPress={() => navigation.navigate('InvoiceTemplates')}
          testID="settings-row-invoice-template"
          tag={activeTemplateLabel ? `${activeTemplateLabel} active` : undefined}
        />
      </Section>

      <Section title="Backup">
        <SettingsRow
          icon="cloud"
          label="Backup & restore"
          description="Google Drive backup, automatic backup, and restore"
          onPress={() => navigation.navigate('Backup')}
          testID="settings-row-backup"
        />
        <SettingsRow
          icon="upload-cloud"
          label="Cloud backup"
          description="Optional paid cloud backup, storage usage, and upgrade"
          onPress={() => navigation.navigate('CloudBackup')}
          testID="settings-row-cloud-backup"
        />
      </Section>

      <Section title="Security">
        <SettingsRow
          icon="shield"
          label="Security"
          description="App Lock and biometric unlock"
          onPress={() => navigation.navigate('Security')}
          testID="settings-row-security"
        />
      </Section>

      <Section title="Account">
        <SettingsRow
          icon="user"
          label="Account"
          description="Account, subscription, and logout"
          onPress={() => navigation.navigate('Account')}
          testID="settings-row-account"
        />
      </Section>

      {/* DESIGN ONLY: no export capability exists anywhere in this app. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Export tax and audit bundle — DESIGN ONLY, not implemented"
        testID="action-export-audit-design-only"
        onPress={() => Alert.alert('Not available', 'CSV/PDF export is not implemented yet.')}
        style={({ pressed }) => [styles.exportButton, pressed && styles.pressed]}
      >
        <Feather name="download" size={18} color={colors.primary} />
        <Text style={styles.exportButtonText}>Export Tax &amp; Audit Bundle · DESIGN ONLY</Text>
      </Pressable>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  identityLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.background },
  identityLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityLogoPlaceholderText: { color: colors.primaryText, fontSize: 18, fontWeight: '700' },
  identityTextCol: { flex: 1, minWidth: 0 },
  identityName: { fontSize: 16, fontWeight: '700', color: colors.text },
  identityCaption: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  section: { gap: 8 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 2,
  },
  sectionCard: { gap: 8 },

  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginTop: 4,
  },
  exportButtonText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
