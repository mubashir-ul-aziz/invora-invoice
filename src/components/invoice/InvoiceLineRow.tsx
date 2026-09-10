import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
   * Small quantity icon button shown next to Remove. Opens the same Edit
   * Invoice Line screen as `onPress` — a more discoverable, explicit
   * affordance for adjusting a line's quantity, alongside the row already
   * being tappable as a whole.
   */
  onEdit?: () => void;
  onDelete?: () => void;
  testID?: string;
}

/** One invoice line, used on Create Invoice – Items, Invoice Review, and Invoice Detail. */
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
  const quantityLabel = measurementLabel ?? (quantity != null ? `${formatNumber(quantity)}${unit ? ` ${unit}` : ''}` : null);
  const subtitle = quantityLabel
    ? `${quantityLabel} × ${unitPrice.toFixed(2)}`
    : `${unitPrice.toFixed(2)} each`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Edit ${itemName || 'line item'}` : undefined}
        testID={testID}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && !!onPress && styles.pressed]}
      >
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {itemName || 'Untitled line'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={styles.total} numberOfLines={1}>
          {lineTotal.toFixed(2)}
        </Text>
        {!!onEdit && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit quantity for ${itemName || 'line item'}`}
            testID={testID ? `${testID}-quantity` : undefined}
            onPress={onEdit}
            hitSlop={8}
            style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}
          >
            <Feather name="hash" size={16} color={colors.primary} />
          </Pressable>
        )}
        {!!onDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${itemName || 'line item'}`}
            testID={testID ? `${testID}-delete` : undefined}
            onPress={onDelete}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteLabel}>Remove</Text>
          </Pressable>
        )}
      </Pressable>
    </ScrollView>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  // Fixed (non-shrinking) width so the name/subtitle never wrap onto a
  // second line — on a narrow screen the row instead overflows its
  // ScrollView and the whole line scrolls horizontally (see the ScrollView
  // wrapping this row above), rather than the text squeezing or wrapping.
  info: { width: 160, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  total: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 64, textAlign: 'right' },
  quantityButton: { padding: 6, borderRadius: 8 },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 8 },
  deleteLabel: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
