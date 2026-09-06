import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceDetailsFormFields } from '@/components/invoice/InvoiceDetailsFormFields';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import { calculateInvoiceTotals, calculateLineTotal } from '@/domain/invoice/calculations';
import { formValuesToInvoiceDetails, invoiceToDetailsFormDefaults } from '@/domain/invoice/formMapping';
import {
  invoiceDetailsFormSchema,
  type InvoiceDetailsFormOutput,
  type InvoiceDetailsFormValues,
} from '@/domain/invoice/validation';
import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceStore } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceReview'>;

/**
 * Invoice Review — the final step for create/edit/duplicate alike, branching
 * only on `invoiceDraftStore.mode`. Totals are computed once, by
 * `domain/invoice/calculations.ts`, and rendered by `InvoiceTotalsSummary` —
 * never summed here.
 */
export function InvoiceReviewScreen({ navigation }: Props) {
  const draft = useInvoiceDraftStore();
  const { create, update, getById } = useInvoiceStore();
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    if (draft.mode === 'edit' && draft.editingInvoiceId) {
      getById(draft.editingInvoiceId).then((invoice) => setExistingInvoiceNumber(invoice?.invoiceNumber ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.mode, draft.editingInvoiceId]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceDetailsFormValues, unknown, InvoiceDetailsFormOutput>({
    resolver: zodResolver(invoiceDetailsFormSchema),
    defaultValues: invoiceToDetailsFormDefaults(draft),
  });

  const totals = calculateInvoiceTotals(
    draft.items.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
    })),
  );

  const invoiceNumberLabel =
    draft.mode === 'edit'
      ? existingInvoiceNumber
      : profile
        ? formatNextInvoiceNumber(profile.invoicePrefix, profile.nextInvoiceNumber)
        : null;

  const onSubmit = handleSubmit(async (values) => {
    const details = formValuesToInvoiceDetails(values);
    if (!draft.customer) {
      Alert.alert("Couldn't save", 'No customer is selected for this invoice.');
      return;
    }
    try {
      const saved =
        draft.mode === 'edit' && draft.editingInvoiceId
          ? await update(draft.editingInvoiceId, { ...details, items: draft.items })
          : await create({
              customerId: draft.customer.id,
              customerName: draft.customer.name,
              invoiceTypeId: draft.invoiceTypeId,
              ...details,
              items: draft.items,
            });
      draft.reset();
      navigation.popToTop();
      navigation.navigate('InvoiceDetail', { invoiceId: saved.id });
    } catch {
      Alert.alert("Couldn't save", 'This invoice could not be saved. Please try again.');
    }
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="invoice-review-screen">
      <View style={styles.summaryCard}>
        {!!invoiceNumberLabel && (
          <SummaryRow label="Invoice number" value={invoiceNumberLabel} testID="review-invoice-number" />
        )}
        <SummaryRow label="Customer" value={draft.customer?.name ?? '—'} />
        <SummaryRow label="Invoice type" value={getInvoiceTypeDefinition(draft.invoiceTypeId).label} />
      </View>

      <InvoiceDetailsFormFields control={control} errors={errors} />

      <View style={styles.itemsSection}>
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>Items</Text>
          <ActionButton
            label="Edit items"
            onPress={() => navigation.navigate('CreateInvoiceItems')}
            testID="action-edit-items"
          />
        </View>
        {draft.items.map((line, index) => {
          const calc = calculateLineTotal({
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            taxPercent: line.taxPercent,
          });
          return (
            <InvoiceLineRow
              key={index}
              itemName={line.itemName}
              quantity={line.quantity}
              unit={line.unit}
              unitPrice={line.unitPrice}
              lineTotal={calc.lineTotal}
              testID={`review-line-${index}`}
            />
          );
        })}
      </View>

      <InvoiceTotalsSummary totals={totals} testID="invoice-review-totals" />

      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save invoice'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-invoice"
      />
    </ScrollView>
  );
}

function SummaryRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.summaryRow} testID={testID}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  itemsSection: { gap: 10 },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
});
