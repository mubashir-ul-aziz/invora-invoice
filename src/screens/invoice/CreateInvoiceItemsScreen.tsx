import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { PRICING_METHOD_OPTIONS, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateInvoiceItems'>;

/**
 * "Create Invoice – Items", restyled to match the Stitch "Line Items"
 * design: a real Step 2 of 3 progress tracker, a "Bill to" client chip, the
 * Pricing Method card, line-item cards with running totals, and a sticky
 * Subtotal/VAT/Total summary ending in "Continue to Review".
 *
 * Fields on each line dynamically follow the invoice's selected Pricing
 * Method (`resolveInvoiceFieldConfig`) — this screen never hard-codes which
 * fields exist. Also reused, unchanged, as the items-editing step for Edit
 * Invoice and Duplicate Invoice (both seed `invoiceDraftStore` before
 * navigating here) — hence "Step 2 of 3" only renders in `create` mode; an
 * in-progress edit/duplicate isn't a fresh 3-step wizard.
 *
 * "Add Discount" / "Add Shipping / Fee" as invoice-level extras have no
 * backing capability and are DESIGN ONLY: discount and tax are real, but
 * per-*line* (`InvoiceItemSnapshot.discountPercent`/`taxPercent`, edited via
 * Edit Invoice Line), and there's no invoice-level shipping/fee line anywhere
 * in the domain model. Both buttons are interactive-but-inert, explaining the
 * real per-line equivalent instead of pretending to add an invoice-wide extra.
 * The Stitch mock's "Standard VAT (20%) applied automatically" toggle implies
 * one invoice-wide tax switch; this app's real tax is per-line (and often
 * per-method-default from the catalog item), so it isn't reproduced as a
 * single toggle — the real per-line tax is what `InvoiceTotalsSummary`'s VAT
 * row below already sums for real.
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
    <View style={styles.screen}>
      {draft.mode === 'create' && (
        <View style={styles.stepBar}>
          <View style={styles.stepBarTopRow}>
            <View style={styles.stepBadgeRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepLabel}>Step 2 of 3</Text>
            </View>
            <Text style={styles.stepNextLabel}>Next: Payment &amp; Review</Text>
          </View>
          <View style={styles.stepProgressRow}>
            <View style={[styles.stepSegment, styles.stepSegmentDone]} />
            <View style={[styles.stepSegment, styles.stepSegmentDone]} />
            <View style={styles.stepSegment} />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        testID="create-invoice-items-screen"
      >
        <View style={styles.customerRow}>
          <View style={styles.customerIcon}>
            <Feather name="briefcase" size={16} color={colors.primary} />
          </View>
          <View style={styles.customerTextCol}>
            <Text style={styles.customerLabel}>BILL TO</Text>
            <Text style={styles.customerName} numberOfLines={1}>
              {draft.customer.name}
            </Text>
          </View>
        </View>

        {draft.mode === 'edit' ? (
          // The pricing method is fixed once an invoice is saved (`Invoice.invoiceTypeId`'s
          // doc comment) — `InvoiceUpdateInput` doesn't even accept a new one, so
          // showing an interactive picker here would let the user "change" a value
          // that's silently ignored at save time. A read-only summary instead.
          <View style={styles.readonlyCard} testID="invoice-type-readonly">
            <Text style={styles.customerLabel}>Pricing Method</Text>
            <Text style={styles.customerName}>{getInvoiceTypeDefinition(draft.invoiceTypeId).label}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <OptionPicker
              label="Pricing Method"
              options={PRICING_METHOD_OPTIONS}
              value={draft.invoiceTypeId}
              onChange={handleInvoiceTypeChange}
              testID="invoice-type-picker"
            />
          </View>
        )}

        <View style={styles.itemsSection}>
          <View style={styles.itemsHeaderRow}>
            <View style={styles.itemsHeaderLeft}>
              <Text style={styles.sectionTitle}>Invoice Items</Text>
              <Text style={styles.itemsCountText}>
                ({draft.items.length} item{draft.items.length === 1 ? '' : 's'} added)
              </Text>
            </View>
          </View>

          {draft.items.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Feather name="package" size={22} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle} testID="invoice-items-empty">
                No items added yet
              </Text>
              <Text style={styles.emptySubtitle}>Tap below to add catalog items or enter custom services.</Text>
            </View>
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
                onEdit={() => navigation.navigate('EditInvoiceLine', { lineIndex: index })}
                onDelete={() => handleRemoveLine(index)}
                testID={`invoice-line-${index}`}
              />
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Line Item"
            testID="action-add-item"
            onPress={handleAddFromCatalog}
            style={({ pressed }) => [styles.addItemButton, pressed && styles.pressed]}
          >
            <Feather name="plus-circle" size={18} color={colors.primary} />
            <Text style={styles.addItemButtonText}>Add Line Item</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add custom line"
            testID="action-add-manual-line"
            onPress={handleAddManualLine}
            style={({ pressed }) => [styles.addManualButton, pressed && styles.pressed]}
          >
            <Feather name="edit-3" size={15} color={colors.textMuted} />
            <Text style={styles.addManualButtonText}>Add custom line</Text>
          </Pressable>

          <View style={styles.designOnlyRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add discount — DESIGN ONLY, no invoice-level discount exists"
              testID="action-add-discount-design-only"
              onPress={() =>
                Alert.alert('Not available', 'Discount is set per line item (in Edit Invoice Line), not for the whole invoice.')
              }
              style={styles.designOnlyChip}
            >
              <Feather name="percent" size={14} color={colors.textMuted} />
              <Text style={styles.designOnlyChipText}>Add Discount · DESIGN ONLY</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add shipping or fee — DESIGN ONLY, no such field exists"
              testID="action-add-shipping-design-only"
              onPress={() => Alert.alert('Not available', 'There is no invoice-level shipping/fee line in this app yet.')}
              style={styles.designOnlyChip}
            >
              <Feather name="truck" size={14} color={colors.textMuted} />
              <Text style={styles.designOnlyChipText}>Add Shipping · DESIGN ONLY</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.dock}>
        {draft.items.length > 0 && <InvoiceTotalsSummary totals={totals} testID="invoice-items-totals" />}
        <ActionButton
          label="Continue to review"
          variant="primary"
          onPress={handleContinue}
          testID="action-continue-to-review"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  pressed: { opacity: 0.75 },

  stepBar: { padding: 16, paddingBottom: 10, gap: 8, backgroundColor: colors.background },
  stepBarTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNumber: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 10, fontWeight: '700', color: colors.primaryText },
  stepLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  stepNextLabel: { fontSize: 11, color: colors.textMuted },
  stepProgressRow: { flexDirection: 'row', gap: 6 },
  stepSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  stepSegmentDone: { backgroundColor: colors.primary },

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  customerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  customerTextCol: { flex: 1, minWidth: 0 },
  customerLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  readonlyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },

  itemsSection: { gap: 8 },
  itemsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemsHeaderLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemsCountText: { fontSize: 12, color: colors.textMuted },

  emptyCard: { alignItems: 'center', gap: 4, padding: 24, backgroundColor: colors.surface, borderRadius: 14 },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  addItemButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  addManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  addManualButtonText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  designOnlyRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  designOnlyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 36,
    borderRadius: 8,
  },
  designOnlyChipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  dock: {
    gap: 10,
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
