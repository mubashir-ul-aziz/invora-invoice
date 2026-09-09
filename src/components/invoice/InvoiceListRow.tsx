import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import { formatTimestamp } from '@/domain/shared/formatting';
import type { InvoiceWithStatus } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

interface Props {
  entry: InvoiceWithStatus;
  onPress: () => void;
  testID?: string;
}

/** One row on the Invoice List screen: number, customer, date, computed status and grand total. */
export function InvoiceListRow({ entry, onPress, testID }: Props) {
  const { invoice, status, totals } = entry;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open invoice ${invoice.invoiceNumber}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.number} numberOfLines={1}>
          {invoice.invoiceNumber}
        </Text>
        <Text style={styles.customer} numberOfLines={1}>
          {invoice.customerName}
        </Text>
        <Text style={styles.date}>{formatDate(invoice.issueDate)}</Text>
        <Text style={styles.created} testID={testID ? `${testID}-created` : undefined}>
          Created {formatTimestamp(invoice.createdAt)}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.total}>{totals.grandTotal.toFixed(2)}</Text>
        <InvoiceStatusBadge status={status} testID={testID ? `${testID}-status` : undefined} />
      </View>
    </Pressable>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  number: { fontSize: 15, fontWeight: '700', color: colors.text },
  customer: { fontSize: 13, color: colors.text },
  date: { fontSize: 12, color: colors.textMuted },
  created: { fontSize: 11, color: colors.textMuted },
  trailing: { alignItems: 'flex-end', gap: 6 },
  total: { fontSize: 14, fontWeight: '700', color: colors.text },
});
