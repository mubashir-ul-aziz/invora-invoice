import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Customer } from '@/domain/customer/types';
import { formatTimestamp } from '@/domain/shared/formatting';
import { colors } from '@/theme/colors';

interface Props {
  customer: Customer;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testID?: string;
}

/** One row on the Customer List screen: name, phone/email summary, and edit/delete actions. */
export function CustomerListRow({ customer, onPress, onEdit, onDelete, testID }: Props) {
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
        <Text style={styles.created} testID={testID ? `${testID}-created` : undefined}>
          Created {formatTimestamp(customer.createdAt)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${customer.name}`}
          testID={testID ? `${testID}-edit` : undefined}
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${customer.name}`}
          testID={testID ? `${testID}-delete` : undefined}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>
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
  created: { fontSize: 11, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButton: { padding: 8, borderRadius: 8 },
});
