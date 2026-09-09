import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import { calculateInvoiceTotals, calculateLineTotal } from '@/domain/invoice/calculations';
import {
  canSafelyConvertPricingMethod,
  invoiceLineFromItem,
  reconcileInvoiceLineWithFieldConfig,
} from '@/domain/invoice/snapshot';
import { describeLineMeasurement } from '@/domain/invoiceType/calculators';
import { INVOICE_TYPE_REGISTRY, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateInvoiceItems'>;

const PRICING_METHOD_OPTIONS = INVOICE_TYPE_REGISTRY.map((def) => ({ value: def.id, label: def.label }));

/**
 * "Create Invoice – Items". Fields on each line dynamically follow the
 * invoice's selected Pricing Method (`resolveInvoiceFieldConfig`) — this
 * screen never hard-codes which fields exist. Also reused, unchanged, as the
 * items-editing step for Edit Invoice and Duplicate Invoice (both seed
 * `invoiceDraftStore` before navigating here).
 */
export function CreateInvoiceItemsScreen({ navigation }: Props) {
  const draft = useInvoiceDraftStore();
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldConfig = resolveInvoiceFieldConfig({
    invoiceTypeId: draft.invoiceTypeId,
    customFieldKeys: selection?.customFieldKeys ?? [],
  });

  const totals = calculateInvoiceTotals(
    draft.items.map((line) => ({
      quantity: line.quantity,
      weight: line.weight,
      length: line.length,
      width: line.width,
      height: line.height,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
    })),
    draft.invoiceTypeId,
  );

  /**
   * §19 of the brief: an invoice with zero items can switch Pricing Method
   * freely; one with items already entered must confirm first, and only a
   * same-family switch (General ↔ Quantity ↔ Service — see
   * `canSafelyConvertPricingMethod`) reuses the entered values afterwards.
   * Anything else has no safe conversion (a length × width has no
   * equivalent weight), so confirming clears the lines instead of silently
   * reinterpreting them — never a corrupted calculation.
   */
  const applyInvoiceTypeChange = (invoiceTypeId: InvoiceTypeId) => {
    const newConfig = resolveInvoiceFieldConfig({
      invoiceTypeId,
      customFieldKeys: selection?.customFieldKeys ?? [],
    });
    if (canSafelyConvertPricingMethod(draft.invoiceTypeId, invoiceTypeId)) {
      draft.items.forEach((line, index) => {
        draft.updateLine(index, reconcileInvoiceLineWithFieldConfig(line, newConfig));
      });
    } else {
      // No safe field-by-field conversion exists between these two methods
      // (see `canSafelyConvertPricingMethod`) — clear every line rather than
      // leave stale, now-meaningless measurements around. `removeLine(0)`
      // repeated for the original count always removes the current head,
      // regardless of how the store re-renders in between.
      for (let i = 0; i < draft.items.length; i += 1) {
        draft.removeLine(0);
      }
    }
    draft.setInvoiceType(invoiceTypeId);
  };

  const handleInvoiceTypeChange = (invoiceTypeId: InvoiceTypeId) => {
    if (invoiceTypeId === draft.invoiceTypeId) {
      return;
    }
    if (draft.items.length === 0) {
      applyInvoiceTypeChange(invoiceTypeId);
      return;
    }
    const safe = canSafelyConvertPricingMethod(draft.invoiceTypeId, invoiceTypeId);
    const newLabel = getInvoiceTypeDefinition(invoiceTypeId).label;
    Alert.alert(
      'Change pricing method?',
      safe
        ? `Changing the pricing method will affect all existing invoice items. Do you want to continue?`
        : `Changing to "${newLabel}" pricing isn't compatible with the items already on this invoice — they'll be removed so the invoice can't end up with mismatched calculations. Do you want to continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: safe ? 'default' : 'destructive',
          onPress: () => applyInvoiceTypeChange(invoiceTypeId),
        },
      ],
    );
  };

  const handleAddFromCatalog = () => {
    navigation.navigate('ItemList', {
      requiredPricingMethodId: draft.invoiceTypeId,
      onSelectItem: (item) => {
        draft.addLine(invoiceLineFromItem(item, fieldConfig));
      },
    });
  };

  const handleAddManualLine = () => {
    navigation.navigate('EditInvoiceLine', { lineIndex: null });
  };

  const handleRemoveLine = (index: number) => {
    const line = draft.items[index];
    Alert.alert('Remove line', `Remove "${line.itemName || 'this line'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => draft.removeLine(index) },
    ]);
  };

  const handleContinue = () => {
    if (draft.items.length === 0) {
      Alert.alert('Add at least one item', 'An invoice needs at least one line item before you continue.');
      return;
    }
    navigation.navigate('InvoiceReview');
  };

  if (!draft.customer) {
    return (
      <View style={styles.centered} testID="create-invoice-items-no-customer">
        <Text style={styles.errorText}>No customer selected for this invoice.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-invoice-items-screen"
    >
      <View style={styles.customerRow}>
        <Text style={styles.customerLabel}>Bill to</Text>
        <Text style={styles.customerName}>{draft.customer.name}</Text>
      </View>

      {draft.mode === 'edit' ? (
        // The pricing method is fixed once an invoice is saved (`Invoice.invoiceTypeId`'s
        // doc comment) — `InvoiceUpdateInput` doesn't even accept a new one, so
        // showing an interactive picker here would let the user "change" a value
        // that's silently ignored at save time. A read-only summary instead.
        <View style={styles.customerRow} testID="invoice-type-readonly">
          <Text style={styles.customerLabel}>Pricing Method</Text>
          <Text style={styles.customerName}>{getInvoiceTypeDefinition(draft.invoiceTypeId).label}</Text>
        </View>
      ) : (
        <OptionPicker
          label="Pricing Method"
          options={PRICING_METHOD_OPTIONS}
          value={draft.invoiceTypeId}
          onChange={handleInvoiceTypeChange}
          testID="invoice-type-picker"
        />
      )}

      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>Items</Text>
        {draft.items.length === 0 && (
          <Text style={styles.emptyText} testID="invoice-items-empty">
            No items added yet.
          </Text>
        )}
        {draft.items.map((line, index) => {
          const calc = calculateLineTotal(
            {
              quantity: line.quantity,
              weight: line.weight,
              length: line.length,
              width: line.width,
              height: line.height,
              unitPrice: line.unitPrice,
              discountPercent: line.discountPercent,
              taxPercent: line.taxPercent,
            },
            draft.invoiceTypeId,
          );
          return (
            <InvoiceLineRow
              key={index}
              itemName={line.itemName}
              quantity={line.quantity}
              unit={line.unit}
              measurementLabel={describeLineMeasurement(draft.invoiceTypeId, line)}
              unitPrice={line.unitPrice}
              lineTotal={calc.lineTotal}
              onPress={() => navigation.navigate('EditInvoiceLine', { lineIndex: index })}
              onDelete={() => handleRemoveLine(index)}
              testID={`invoice-line-${index}`}
            />
          );
        })}
        <View style={styles.addRow}>
          <ActionButton label="+ Add item" onPress={handleAddFromCatalog} testID="action-add-item" />
          <ActionButton label="+ Add custom line" onPress={handleAddManualLine} testID="action-add-manual-line" />
        </View>
      </View>

      {draft.items.length > 0 && <InvoiceTotalsSummary totals={totals} testID="invoice-items-totals" />}

      <ActionButton
        label="Continue to review"
        variant="primary"
        onPress={handleContinue}
        testID="action-continue-to-review"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  customerRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  customerLabel: { fontSize: 12, color: colors.textMuted },
  customerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemsSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
