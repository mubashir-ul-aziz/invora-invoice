import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  itemName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number;
  /** Already computed by `domain/invoice/calculations.ts` — this row never does the math itself. */
  lineTotal: number;
  onPress?: () => void;
  onDelete?: () => void;
  testID?: string;
}

/** One invoice line, used on Create Invoice – Items, Invoice Review, and Invoice Detail. */
export function InvoiceLineRow({ itemName, quantity, unit, unitPrice, lineTotal, onPress, onDelete, testID }: Props) {
  const quantityLabel = quantity != null ? `${formatNumber(quantity)}${unit ? ` ${unit}` : ''}` : null;
  const subtitle = quantityLabel
    ? `${quantityLabel} × ${unitPrice.toFixed(2)}`
    : `${unitPrice.toFixed(2)} each`;

  return (
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
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.total}>{lineTotal.toFixed(2)}</Text>
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
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  total: { fontSize: 14, fontWeight: '700', color: colors.text },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 8 },
  deleteLabel: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
