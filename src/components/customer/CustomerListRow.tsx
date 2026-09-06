import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Customer } from '@/domain/customer/types';
import { colors } from '@/theme/colors';

interface Props {
  customer: Customer;
  onPress: () => void;
  onDelete: () => void;
  testID?: string;
}

/** One row on the Customer List screen: name, phone/email summary, and a delete action. */
export function CustomerListRow({ customer, onPress, onDelete, testID }: Props) {
  const subtitleParts = [customer.phone, customer.email].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${customer.name}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        {subtitleParts.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${customer.name}`}
        testID={testID ? `${testID}-delete` : undefined}
        onPress={onDelete}
        hitSlop={8}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
      >
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 8 },
  deleteLabel: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
