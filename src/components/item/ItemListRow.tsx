import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { Item } from '@/domain/item/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

interface Props {
  item: Item;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testID?: string;
}

/** Per-Pricing-Method icon + tint, matching the Stitch mock's varied per-category card icons — picked deterministically from `invoiceTypeId` so a method always renders the same way. Exported so other Pricing-Method displays (e.g. `InvoiceTypeCard`) reuse the same mapping instead of redefining it. */
export const METHOD_STYLE: Record<InvoiceTypeId, { icon: keyof typeof Feather.glyphMap; bg: string; fg: string }> = {
  general: { icon: 'box', bg: '#E5EEFF', fg: colors.primary },
  quantity: { icon: 'hash', bg: '#E5EEFF', fg: colors.primary },
  weight: { icon: 'anchor', bg: '#DAE2FD', fg: '#3F465C' },
  length: { icon: 'move', bg: '#DAE2FD', fg: '#3F465C' },
  area: { icon: 'square', bg: '#DAE2FD', fg: '#3F465C' },
  volume: { icon: 'archive', bg: '#DAE2FD', fg: '#3F465C' },
  time: { icon: 'clock', bg: '#DBFCEC', fg: '#006243' },
  service: { icon: 'tool', bg: '#DBFCEC', fg: '#006243' },
  custom: { icon: 'sliders', bg: '#DCE9FF', fg: '#003EA8' },
};

/**
 * One card on the Items List screen — Stitch's "Items Catalog" row: a
 * Pricing-Method icon, name, SKU/method detail line, a unit + tax badge row,
 * the price, and edit/delete actions.
 *
 * The Stitch mock also shows a per-item stock figure ("Stock: 140 m",
 * "In Stock", "82 packs") — `Item` (domain/item/types.ts) has no
 * stock/quantity-on-hand field at all, so that figure can't be connected to
 * real data. Rather than invent a number, the right-hand caption is a
 * "DESIGN ONLY" badge instead of a fabricated stock status.
 */
export function ItemListRow({ item, onPress, onEdit, onDelete, testID }: Props) {
  const methodDef = getInvoiceTypeDefinition(item.invoiceTypeId);
  const methodStyle = METHOD_STYLE[item.invoiceTypeId];
  const currencySymbol = useCurrencySymbol();

  const detailParts = [item.sku ? `SKU ${item.sku}` : null, methodDef.label].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: methodStyle.bg }]}>
        <Feather name={methodStyle.icon} size={18} color={methodStyle.fg} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detailParts.join(' · ')}
        </Text>
        <View style={styles.badgeRow}>
          {!!item.unit && (
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>per {item.unit}</Text>
            </View>
          )}
          <Text style={styles.taxText}>{item.taxRate != null ? `Tax: ${item.taxRate}%` : 'No tax set'}</Text>
        </View>
      </View>

      <View style={styles.valueBlock}>
        <Text style={styles.price}>{currencySymbol}{item.defaultPrice.toFixed(2)}</Text>
        {/* DESIGN ONLY: Stitch shows a real-looking stock figure here ("In Stock", "82 packs") that `Item` has no field to back — see this file's doc comment. */}
        <Text style={styles.designOnly} testID={testID ? `${testID}-stock-design-only` : undefined}>
          DESIGN ONLY
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          testID={testID ? `${testID}-edit` : undefined}
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={15} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          testID={testID ? `${testID}-delete` : undefined}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  unitBadge: { backgroundColor: colors.background, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  unitBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  taxText: { fontSize: 11, color: colors.textMuted },
  valueBlock: { alignItems: 'flex-end', gap: 3, flexShrink: 0, paddingLeft: 4 },
  price: { fontSize: 16, fontWeight: '700', color: colors.text },
  designOnly: { fontSize: 9, fontWeight: '700', color: colors.placeholder, letterSpacing: 0.3 },
  actions: { flexDirection: 'column', gap: 2, flexShrink: 0 },
  actionButton: { padding: 6, borderRadius: 8 },
});
