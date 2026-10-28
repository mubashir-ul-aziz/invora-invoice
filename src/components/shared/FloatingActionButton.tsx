import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * Bottom-padding a list needs so its last row can scroll clear of the button:
 * the button's bottom offset (24) + height (48) + a 24px gap.
 */
export const FAB_LIST_BOTTOM_PADDING = 96;

interface Props {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Solid blue floating button pinned to the bottom-right of its parent. Render
 * it inside the view that sits *above* the bottom nav (not the whole screen),
 * so it floats just over the nav instead of on top of it.
 */
export function FloatingActionButton({ label, icon, onPress, accessibilityLabel, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.primaryText} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  label: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
