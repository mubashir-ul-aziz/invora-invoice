import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  testID?: string;
}

/**
 * One row in the Custom Invoice Type field builder: a label plus a
 * checkbox-style toggle. `disabled` is used for the always-included fields
 * (Item Name, Unit Price) — shown checked and non-interactive rather than
 * hidden, so it's clear they're part of every invoice.
 */
export function FieldToggleRow({ label, checked, disabled, onToggle, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      testID={testID}
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        checked && styles.rowChecked,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
      {!!disabled && <Text style={styles.lockedHint}>Always included</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowChecked: { borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.85 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.primaryText, fontSize: 13, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  lockedHint: { fontSize: 11, color: colors.textMuted },
});
