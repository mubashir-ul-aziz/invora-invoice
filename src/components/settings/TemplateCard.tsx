import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** One selectable invoice template on the Invoice Templates screen — mirrors `InvoiceTypeCard`'s layout without the "Fields:" line, since a template has no field list of its own. */
export function TemplateCard({ label, description, selected, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {selected && <Text style={styles.selectedBadge}>Selected</Text>}
      </View>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  selectedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  description: { fontSize: 13, color: colors.textMuted },
});
