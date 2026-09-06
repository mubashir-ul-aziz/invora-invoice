import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CustomerActivityEntry } from '@/domain/customer/types';
import { colors } from '@/theme/colors';

interface Props {
  entry: CustomerActivityEntry;
  testID?: string;
}

/** One row on the Customer History screen — an invoice or a payment, newest-first. */
export function CustomerActivityRow({ entry, testID }: Props) {
  const isInvoice = entry.type === 'invoice';
  return (
    <View style={styles.row} testID={testID}>
      <View
        style={[styles.badge, isInvoice ? styles.badgeInvoice : styles.badgePayment]}
        testID={testID ? `${testID}-badge` : undefined}
      >
        <Text style={styles.badgeLabel}>{isInvoice ? 'Invoice' : 'Payment'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={styles.date}>{formatDate(entry.date)}</Text>
      </View>
      <View style={styles.amountColumn}>
        <Text style={styles.amount}>{entry.amount.toFixed(2)}</Text>
        {!!entry.status && <Text style={styles.status}>{entry.status}</Text>}
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
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
  badge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  badgeInvoice: { backgroundColor: '#E4EAFB' },
  badgePayment: { backgroundColor: '#E3F3E8' },
  badgeLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  date: { fontSize: 12, color: colors.textMuted },
  amountColumn: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text },
  status: { fontSize: 11, color: colors.textMuted },
});
