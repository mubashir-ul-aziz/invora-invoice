import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /**
   * `primary` — the one solid blue call-to-action on a screen.
   * `secondary` (default) — outlined/white, for other actions of equal weight.
   * `text` — no fill or border, for low-emphasis actions (e.g. "Try again").
   */
  variant?: 'primary' | 'secondary' | 'text';
  /** Optional leading icon (Feather glyph name), for icon+text buttons. */
  icon?: keyof typeof Feather.glyphMap;
}

export function ActionButton({ label, onPress, disabled, testID, variant = 'secondary', icon }: Props) {
  const iconColor = variant === 'primary' ? colors.primaryText : variant === 'text' ? colors.primary : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.text,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {!!icon && <Feather name={icon} size={15} color={iconColor} style={styles.icon} />}
      <Text
        style={
          variant === 'primary' ? styles.primaryLabel : variant === 'text' ? styles.textLabel : styles.secondaryLabel
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 40,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  text: { minWidth: 0, paddingHorizontal: 8, backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  icon: { marginRight: 6 },
  primaryLabel: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
  secondaryLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  textLabel: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
