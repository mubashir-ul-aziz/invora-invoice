import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SettingsRow } from '@/components/business/SettingsRow';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessSettings'>;

/** Settings hub: routes into the business profile editor and invoice settings. */
export function BusinessSettingsScreen({ navigation }: Props) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="business-settings-screen"
    >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
});
