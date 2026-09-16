import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  checked: boolean;
  disabled?: boolean;
  /** Text shown next to a disabled row explaining why. Defaults to the Custom Invoice Type builder's own wording; Phase 10's Security screen passes its own (e.g. "Not supported on this device"). */
  disabledHint?: string;
  /** Optional leading icon square and a one-line description beneath the label — used by the Custom Invoice Type builder's Stitch-restyled rows. Callers that don't pass these (e.g. the Security screen's toggles) keep the plain label+switch layout. */
  icon?: keyof typeof Feather.glyphMap;
  description?: string;
  onToggle: () => void;
  testID?: string;
}

/**
 * A label plus a switch-style toggle — originally built for the Custom
 * Invoice Type field builder (`disabled` there marks the always-included
 * fields, Item Name/Unit Price, shown checked and non-interactive rather
 * than hidden) and reused as-is by the Phase 10 Security screen's App
 * Lock / Biometric Unlock toggles, per "reuse over near-duplicate
 * components". Restyled to a switch (was a checkbox) with an optional
 * leading icon + description line, matching the Stitch Custom Invoice Type
 * design; both new props are optional so existing callers are unaffected.
 */
export function FieldToggleRow({
  label,
  checked,
  disabled,
  disabledHint = 'Always included',
  icon,
  description,
  onToggle,
  testID,
}: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      testID={testID}
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}
    >
      {!!icon && (
        <View style={styles.icon}>
          <Feather name={icon} size={17} color={colors.primary} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        {!!description && (
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        )}
        {!!disabled && <Text style={styles.lockedHint}>{disabledHint}</Text>}
      </View>
      <View style={[styles.switch, checked && styles.switchOn, disabled && styles.switchDisabled]}>
        <View style={[styles.switchThumb, checked && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

const SWITCH_WIDTH = 42;
const SWITCH_HEIGHT = 24;
const THUMB_SIZE = 18;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.7 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  description: { fontSize: 11, color: colors.textMuted },
  lockedHint: { fontSize: 11, color: colors.textMuted },
  switch: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    backgroundColor: colors.background,
    padding: 2,
    flexShrink: 0,
  },
  switchOn: { backgroundColor: colors.primary },
  switchDisabled: { opacity: 0.85 },
  switchThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.surface,
  },
  switchThumbOn: { transform: [{ translateX: SWITCH_WIDTH - THUMB_SIZE - 4 }] },
});
