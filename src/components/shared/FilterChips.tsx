import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * The app-wide filter chip row, modelled on the Invoice List's status pills:
 * one horizontally scrollable line that never wraps or shrinks its chips.
 *
 * `bleed` should equal the parent's horizontal padding — the row extends past
 * that padding so chips scroll edge-to-edge, while the first chip still lines
 * up with the content above it.
 */
export function FilterChipRow({
  children,
  bleed = 16,
  testID,
}: {
  children: React.ReactNode;
  bleed?: number;
  testID?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, { marginHorizontal: -bleed }]}
      contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

export function FilterChip({
  label,
  count,
  icon,
  active,
  danger,
  onPress,
  testID,
}: {
  label: string;
  count?: number;
  icon?: keyof typeof Feather.glyphMap;
  active: boolean;
  /** Tints the count red while inactive, for "needs attention" filters like Due. */
  danger?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: active }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.chipPressed]}
    >
      {icon && <Feather name={icon} size={14} color={active ? colors.primaryText : colors.textMuted} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count !== undefined && (
        <Text style={[styles.chipCount, danger && styles.chipCountDanger, active && styles.chipCountActive]}>
          ({count})
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipPressed: { opacity: 0.75 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  chipCount: { fontSize: 11, fontWeight: '500', color: colors.placeholder },
  chipCountDanger: { color: colors.danger },
  chipCountActive: { color: colors.primaryText, opacity: 0.8 },
});
