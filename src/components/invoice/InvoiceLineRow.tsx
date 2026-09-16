import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

interface Props {
  itemName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number;
  /**
   * Method-aware measurement description (e.g. "5m × 4m (20 m²)" for an AREA
   * line, "25 kg" for WEIGHT — see `describeLineMeasurement`). When given,
   * this replaces the generic "quantity unit" reading below it, since a
   * measured line's calculation is the whole point of showing it.
   */
  measurementLabel?: string | null;
  /** Already computed by `domain/invoice/calculations.ts` — this row never does the math itself. */
  lineTotal: number;
  onPress?: () => void;
  /**
   * Edit-pencil icon button, opening the same Edit Invoice Line screen as
   * `onPress` — a more discoverable, explicit affordance alongside the row
   * already being tappable as a whole.
   */
  onEdit?: () => void;
  onDelete?: () => void;
  testID?: string;
}

/**
 * One invoice line, used on Create Invoice – Items, Invoice Review, and
 * Invoice Detail (read-only there — no `onEdit`/`onDelete` passed). Restyled
 * to match the Stitch line-item card: name + total up top, a measurement
 * chip + edit/delete icon buttons below.
 *
 * Stitch's mock also shows a drag handle for manual reordering and a per-item
 * "category" tag (e.g. "Materials & Supplies") — `InvoiceItemSnapshot` has no
 * category field, and `invoiceDraftStore` has no reorder method (only
 * `addLine`/`updateLine`/`removeLine`), so the drag handle is shown as an
 * inert DESIGN ONLY affordance (only in editable contexts) and the category
 * tag isn't reproduced rather than inventing a value.
 */
export function InvoiceLineRow({
  itemName,
  quantity,
  unit,
  unitPrice,
  measurementLabel,
  lineTotal,
  onPress,
  onEdit,
  onDelete,
  testID,
}: Props) {
  const currencySymbol = useCurrencySymbol();
  const quantityLabel = measurementLabel ?? (quantity != null ? `${formatNumber(quantity)}${unit ? ` ${unit}` : ''}` : null);
  const subtitle = quantityLabel
    ? `${quantityLabel} × ${currencySymbol}${unitPrice.toFixed(2)}`
    : `${currencySymbol}${unitPrice.toFixed(2)} each`;
  const editable = !!onEdit || !!onDelete;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Edit ${itemName || 'line item'}` : undefined}
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && !!onPress && styles.pressed]}
    >
      <View style={styles.topRow}>
        {editable && (
          // DESIGN ONLY: `invoiceDraftStore` has no reorder method — decorative handle only.
          <View
            style={styles.dragHandle}
            accessibilityLabel="Reorder line — DESIGN ONLY, not supported"
          >
            <Feather name="menu" size={16} color={colors.placeholder} />
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {itemName || 'Untitled line'}
        </Text>
        <Text style={styles.total} numberOfLines={1}>
          {currencySymbol}{lineTotal.toFixed(2)}
        </Text>
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.subtitleChip}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.actions}>
          {!!onEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${itemName || 'line item'}`}
              testID={testID ? `${testID}-quantity` : undefined}
              onPress={onEdit}
              hitSlop={8}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Feather name="edit-2" size={15} color={colors.primary} />
            </Pressable>
          )}
          {!!onDelete && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${itemName || 'line item'}`}
              testID={testID ? `${testID}-delete` : undefined}
              onPress={onDelete}
              hitSlop={8}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dragHandle: { padding: 2 },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  total: { fontSize: 15, fontWeight: '700', color: colors.text },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subtitleChip: { flex: 1, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  subtitle: { fontSize: 12, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  actionButton: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
