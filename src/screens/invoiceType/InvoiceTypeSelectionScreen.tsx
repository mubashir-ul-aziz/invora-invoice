import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceTypeCard } from '@/components/invoiceType/InvoiceTypeCard';
import { describeFixedTypeFields, describeSelectionFields } from '@/domain/invoiceType/formMapping';
import { INVOICE_TYPE_REGISTRY } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceTypeSelection'>;

/**
 * "Invoice Type Selection" screen (Phase 3). Walks `INVOICE_TYPE_REGISTRY`
 * instead of hard-coding the five types here — adding a new type later is a
 * registry change, not a screen change.
 *
 * Restyled to match the Stitch design: a "Applies to New Invoices" status
 * pill above the hint text, and `InvoiceTypeCard`'s per-method icon/radio/
 * "ACTIVE" badge treatment. Real behavior is unchanged — tapping a fixed
 * type still saves immediately and navigates back (there's nothing left to
 * "Save" afterward, so unlike Invoice Templates' footer "Done" button, this
 * screen has no bottom action bar); tapping "Custom" still opens Custom
 * Invoice Type without saving. The Stitch mock's "Most Popular" badge and
 * "Smart Recalculation Active" tip aren't reproduced: "most popular" would
 * be a fabricated usage-popularity claim with no real data behind it, and
 * the recalculation tip describes `CreateInvoiceItemsScreen`'s per-invoice
 * pricing-method switch (§19), not this business-level default — it doesn't
 * apply here. Its "View calculation guide" link is dropped rather than
 * marked DESIGN ONLY, matching how Invoice Review's compliance-claim copy
 * was dropped rather than badged.
 */
export function InvoiceTypeSelectionScreen({ navigation }: Props) {
  const { status, selection, error, load, save } = useInvoiceTypeStore();

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="invoice-type-selection-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="invoice-type-selection-error">
        <Text style={styles.errorText}>Couldn't load your pricing method.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const selectedId = selection?.invoiceTypeId ?? 'general';

  const selectFixedType = async (id: (typeof INVOICE_TYPE_REGISTRY)[number]['id']) => {
    try {
      await save({ invoiceTypeId: id, customFieldKeys: [] });
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'Your pricing method could not be saved. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="invoice-type-selection-screen"
    >
      <View style={styles.headerBlock}>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>Applies to New Invoices</Text>
        </View>
        <Text style={styles.hint}>
          Choose the default Pricing Method for a new invoice. Every line item on an invoice always
          follows that invoice's own Pricing Method — chosen once per invoice, in Create Invoice.
        </Text>
      </View>

      {INVOICE_TYPE_REGISTRY.map((def) => (
        <InvoiceTypeCard
          key={def.id}
          id={def.id}
          label={def.label}
          description={def.description}
          fieldsPreview={
            def.fields
              ? describeFixedTypeFields(def.fields)
              : describeSelectionFields({
                  invoiceTypeId: 'custom',
                  customFieldKeys: selection?.customFieldKeys ?? [],
                })
          }
          selected={selectedId === def.id}
          testID={`invoice-type-card-${def.id}`}
          onPress={() => {
            if (def.id === 'custom') {
              navigation.navigate('CustomInvoiceType');
            } else {
              selectFixedType(def.id);
            }
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  headerBlock: { gap: 8, marginBottom: 4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  statusPillText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
