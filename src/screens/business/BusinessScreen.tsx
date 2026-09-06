import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Business'>;

/** The "Business / Company" screen — profile summary + entry points into Edit and Settings. */
export function BusinessScreen({ navigation }: Props) {
  const { status, profile, error, load } = useBusinessProfileStore();

  useEffect(() => {
    load();
  }, [load]);

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
        <Text style={styles.businessName}>
          {profile?.businessName?.trim() || 'Your business name'}
        </Text>

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
        <SummaryRow
          label="Next invoice number"
          value={formatNextInvoiceNumber(
            profile?.invoicePrefix ?? 'INV-',
            profile?.nextInvoiceNumber ?? 1,
          )}
        />
      </View>

      <View style={styles.row}>
        <ActionButton
          label="Edit business"
          variant="primary"
          onPress={() => navigation.navigate('EditBusiness')}
          testID="action-edit-business"
        />
        <ActionButton
          label="Business settings"
          onPress={() => navigation.navigate('BusinessSettings')}
          testID="action-business-settings"
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
  businessName: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
