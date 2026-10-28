import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/colors';

export interface BottomAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Optional leading icon (Feather glyph name). */
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
  /** Defaults to `label`; set it when the label changes while busy (e.g. "Saving…") so the button keeps a stable name. */
  accessibilityLabel?: string;
}

interface Props {
  /** The screen's main call-to-action (Save, Create, Record…). Full width when there's no `secondary`. */
  primary: BottomAction;
  /** A lesser action shown to the left of `primary` — Cancel by default, or a destructive one with `tone: 'danger'`. */
  secondary?: BottomAction & { tone?: 'neutral' | 'danger' };
  /** Optional content shown above the buttons, e.g. a running totals summary. */
  children?: React.ReactNode;
  testID?: string;
}

/**
 * The fixed action bar at the bottom of every screen that hides the main tab
 * bar (create/edit forms and the invoice flow — see `hasBottomActionBar` in
 * `navigation/tabs.ts`). Pass it as `KeyboardAvoidingScreen`'s `footer` so it
 * stays put while only the content above it scrolls, and rides up with the
 * keyboard. The bottom safe-area inset below it is filled by `MainTabBar`'s
 * spacer, which matches this bar's surface colour.
 */
export function BottomActionBar({ primary, secondary, children, testID }: Props) {
  return (
    <View style={styles.bar} testID={testID}>
      {children}
      <View style={styles.row}>
        {secondary && (
          <BarButton
            action={secondary}
            style={secondary.tone === 'danger' ? styles.danger : styles.secondary}
            color={secondary.tone === 'danger' ? colors.danger : colors.text}
          />
        )}
        <BarButton action={primary} style={styles.primary} color={colors.primaryText} />
      </View>
    </View>
  );
}

function BarButton({ action, style, color }: { action: BottomAction; style: object; color: string }) {
  const { label, onPress, disabled, icon, testID, accessibilityLabel = label } = action;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, style, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      {!!icon && <Feather name={icon} size={18} color={color} />}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    height: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { flex: 2, backgroundColor: colors.primary },
  secondary: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { flex: 1, backgroundColor: colors.dangerBg },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  label: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
});
