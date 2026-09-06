import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  description?: string;
  onPress: () => void;
  testID?: string;
}

/** A single navigable row on a settings hub screen. */
export function SettingsRow({ label, description, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  description: { fontSize: 12, color: colors.textMuted },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 8 },
});
