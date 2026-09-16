import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { METHOD_STYLE } from '@/components/item/ItemListRow';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { colors } from '@/theme/colors';

interface Props {
  id: InvoiceTypeId;
  label: string;
  description: string;
  fieldsPreview: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * One selectable Pricing Method on the Invoice Type Selection screen.
 * Restyled to match the Stitch design: a per-method icon (reusing
 * `ItemListRow`'s real `METHOD_STYLE` mapping, so an item's catalog icon and
 * its Pricing Method card icon always agree), a radio indicator, and an
 * "ACTIVE" badge in place of the old plain "Selected" text.
 *
 * The `fieldsPreview` line (`"Fields: ..."`) is unchanged from before the
 * restyle — it's asserted on directly by
 * `InvoiceTypeSelectionScreen.test.tsx`.
 */
export function InvoiceTypeCard({ id, label, description, fieldsPreview, selected, onPress, testID }: Props) {
  const style = METHOD_STYLE[id];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.icon, { backgroundColor: style.bg }]}>
            <Feather name={style.icon} size={18} color={style.fg} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.description} numberOfLines={1}>
              {description}
            </Text>
          </View>
        </View>
        {selected ? (
          <View style={styles.radioSelected}>
            <Feather name="check" size={12} color={colors.primaryText} />
          </View>
        ) : (
          <View style={styles.radio} />
        )}
      </View>

      {selected && (
        <View style={styles.activeBadge}>
          <Feather name="check-circle" size={12} color={colors.primary} />
          <Text style={styles.activeBadgeText}>ACTIVE</Text>
        </View>
      )}

      <Text style={styles.fields} numberOfLines={2}>
        Fields: {fieldsPreview}
      </Text>

      {id === 'custom' && (
        <View style={styles.configureRow}>
          <Text style={styles.configureText}>Tap to configure custom field attributes</Text>
          <Feather name="arrow-right" size={14} color={colors.primary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTextCol: { minWidth: 0 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.background, flexShrink: 0 },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.4 },
  fields: { fontSize: 12, color: colors.text },
  configureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  configureText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
