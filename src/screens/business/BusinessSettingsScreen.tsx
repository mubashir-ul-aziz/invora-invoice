import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessSettings'>;

/**
 * Settings hub: routes into the business profile editor and invoice
 * settings. This was always a pure navigation index (4 `SettingsRow`
 * entries, no fields of its own, no store) — confirmed by inspecting the
 * screen and its one existing test before restyling, per this app's "never
 * fake a backend feature" rule. "Default Payment Terms" is real navigation
 * to Invoice Settings, where `InvoiceSettings.defaultPaymentTermsDays` is
 * edited.
 */
export function BusinessSettingsScreen({ navigation }: Props) {
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

      {/* Client & Billing Automation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client &amp; Billing Automation</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="clock"
            label="Default Payment Terms"
            description="Net terms applied to new invoices"
            onPress={() => navigation.navigate('InvoiceSettings')}
            testID="settings-row-payment-terms"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

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
});
