import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRICE_MODE_OPTIONS, type PriceMode } from '@/domain/invoice/types';
import { colors } from '@/theme/colors';

interface Props {
  value: PriceMode;
  onChange: (mode: PriceMode) => void;
  /** Buttons get `${testID}-unit` / `${testID}-total`. */
  testID: string;
}

/** Unit Price / Total Item Price switch, shared by the Item form and the invoice line editor so the two can never look or behave differently. */
export function PriceModeToggle({ value, onChange, testID }: Props) {
  return (
    <View style={styles.toggle} testID={testID}>
      {PRICE_MODE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            testID={`${testID}-${option.value}`}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 3, gap: 3 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 8 },
  optionSelected: { backgroundColor: colors.primary },
  optionText: { fontSize: 13, fontWeight: '600', color: colors.text },
  optionTextSelected: { color: colors.primaryText },
});
