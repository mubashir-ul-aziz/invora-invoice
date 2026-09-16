import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  description?: string;
  onPress: () => void;
  testID?: string;
  /** Optional leading icon square — used by the Stitch-restyled Business hub; other callers that don't pass it keep the plain label+chevron row. */
  icon?: keyof typeof Feather.glyphMap;
  /** Optional small trailing tag next to the label (e.g. "vCard"). */
  tag?: string;
}

/** A single navigable row on a settings hub screen. */
export function SettingsRow({ label, description, onPress, testID, icon, tag }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {!!icon && (
        <View style={styles.icon}>
          <Feather name={icon} size={19} color={colors.primary} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {!!tag && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          )}
        </View>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  tag: { backgroundColor: colors.background, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  description: { fontSize: 12, color: colors.textMuted },
});
