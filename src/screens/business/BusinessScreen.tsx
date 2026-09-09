import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Business'>;

/** The "Business / Company" screen — profile summary + entry points into Edit and Settings. */
export function BusinessScreen({ navigation }: Props) {
  const { status, profile, error, load } = useBusinessProfileStore();
  // Also preloaded here (not just from the Digital Card screen) so the
  // merged "Business profile" form — reachable from this screen without ever
  // visiting Digital Card — has the card's owner name/social links ready as
  // soon as it mounts, instead of loading them itself (see
  // `EditBusinessScreen`'s doc comment for why it doesn't self-load).
  const { load: loadCard } = useBusinessCardStore();

  useEffect(() => {
    load();
    loadCard();
  }, [load, loadCard]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="business-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="business-error">
        <Text style={styles.errorText}>Couldn't load your business profile.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="business-screen"
    >
      <View style={styles.card} testID="business-summary">
        <View style={styles.identityRow}>
          {profile?.logoUri ? (
            <Image
              source={{ uri: profile.logoUri }}
              style={styles.logo}
              testID="business-logo-image"
            />
          ) : (
            <View style={styles.logoPlaceholder} testID="business-logo-placeholder">
              <Text style={styles.logoPlaceholderText}>
                {(profile?.businessName?.trim() || 'Y').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.businessName}>
            {profile?.businessName?.trim() || 'Your business name'}
          </Text>
        </View>

        {!profile && (
          <Text style={styles.emptyState} testID="business-empty">
            You haven't set up your business profile yet.
          </Text>
        )}

        {!!profile?.address && <SummaryRow label="Address" value={profile.address} />}
        {!!profile?.phone && <SummaryRow label="Phone" value={profile.phone} />}
        {!!profile?.email && <SummaryRow label="Email" value={profile.email} />}
        {!!profile?.website && <SummaryRow label="Website" value={profile.website} />}
        {!!profile?.taxId && <SummaryRow label="Tax / VAT number" value={profile.taxId} />}
        <SummaryRow label="Currency" value={profile?.currency ?? 'USD'} />
        {!!profile?.businessCode && <SummaryRow label="Business ID" value={profile.businessCode} />}
        <SummaryRow
          label="Next invoice number"
          value={formatNextInvoiceNumber(
            profile?.invoicePrefix ?? 'INV-',
            profile?.businessCode ?? '',
            profile?.nextInvoiceNumber ?? 1,
          )}
        />
      </View>

      <View style={styles.section} testID="business-settings-section">
        <Text style={styles.sectionTitle}>Business settings</Text>
        <SettingsRow
          label="Business profile"
          description="Name, logo, address, contact details, invoice prefix"
          onPress={() => navigation.navigate('EditBusiness')}
          testID="settings-row-profile"
        />
        <SettingsRow
          label="Invoice settings"
          description="Prefix, numbering, currency, default tax, template"
          onPress={() => navigation.navigate('InvoiceSettings')}
          testID="settings-row-invoice"
        />
        <SettingsRow
          label="Invoice type"
          description="Which fields appear on an invoice line item"
          onPress={() => navigation.navigate('InvoiceTypeSelection')}
          testID="settings-row-invoice-type"
        />
        <SettingsRow
          label="Digital business card"
          description="Card, QR code, sharing"
          onPress={() => navigation.navigate('DigitalCard')}
          testID="settings-row-card"
        />
      </View>

      <View style={styles.row}>
        <ActionButton
          label="Dashboard"
          onPress={() => navigation.navigate('Dashboard')}
          testID="action-dashboard"
        />
        <ActionButton
          label="Business card"
          onPress={() => navigation.navigate('DigitalCard')}
          testID="action-digital-card"
        />
        <ActionButton
          label="Items"
          onPress={() => navigation.navigate('ItemList')}
          testID="action-items"
        />
        <ActionButton
          label="Customers"
          onPress={() => navigation.navigate('CustomerList')}
          testID="action-customers"
        />
        <ActionButton
          label="Invoices"
          onPress={() => navigation.navigate('InvoiceList')}
          testID="action-invoices"
        />
        <ActionButton
          label="Payments"
          onPress={() => navigation.navigate('PaymentHistory')}
          testID="action-payments"
        />
        <ActionButton
          label="Settings"
          onPress={() => navigation.navigate('Settings')}
          testID="action-settings"
        />
      </View>
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyState: { color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: '700',
  },
  businessName: { fontSize: 18, fontWeight: '700', color: colors.text, flexShrink: 1 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
