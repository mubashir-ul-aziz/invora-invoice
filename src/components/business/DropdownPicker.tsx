import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

/**
 * A single-select dropdown: a tappable field showing the current value, which
 * opens a modal list of options to pick from — as opposed to `OptionPicker`'s
 * row of always-visible chip buttons. Used where a field reads as a form
 * select rather than a set of quick toggles (e.g. Pricing Method).
 */
export function DropdownPicker<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  testID,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (option: Option<T>) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID ? `${testID}-trigger` : undefined}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerLabel}>{selectedOption?.label ?? ''}</Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          testID={testID ? `${testID}-backdrop` : undefined}
        >
          {/* Swallow taps inside the sheet so they don't fall through to the backdrop's dismiss handler. */}
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(option) => String(option.value)}
              renderItem={({ item: option }) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    testID={testID ? `${testID}-option-${String(option.value)}` : undefined}
                    onPress={() => handleSelect(option)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && !selected && styles.optionPressed,
                    ]}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {selected && <Feather name="check" size={18} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  triggerPressed: { opacity: 0.75 },
  triggerLabel: { fontSize: 15, color: colors.text },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  optionPressed: { backgroundColor: colors.background },
  optionSelected: { backgroundColor: colors.background },
  optionLabel: { fontSize: 15, color: colors.text },
  optionLabelSelected: { fontWeight: '700', color: colors.primary },
});
