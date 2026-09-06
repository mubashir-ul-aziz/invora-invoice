import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { Item } from '@/domain/item/types';
import { colors } from '@/theme/colors';

interface Props {
  item: Item;
  onPress: () => void;
  onDelete: () => void;
  testID?: string;
}

/** One row on the Items List screen: name, SKU/unit/price summary, and a delete action. */
export function ItemListRow({ item, onPress, onDelete, testID }: Props) {
  const subtitleParts = [
    item.sku ? `SKU ${item.sku}` : null,
    item.unit ? `per ${item.unit}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.name}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitleParts.length ? subtitleParts.join(' · ') : getInvoiceTypeDefinition(item.invoiceTypeId).label}
        </Text>
      </View>
      <Text style={styles.price}>{item.defaultPrice.toFixed(2)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
        testID={testID ? `${testID}-delete` : undefined}
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
      >
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </Pressable>
  );
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
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  price: { fontSize: 14, fontWeight: '700', color: colors.text },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 8 },
  deleteLabel: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
