import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import type { DashboardRecentInvoice } from '@/domain/dashboard/types';
import { colors } from '@/theme/colors';

interface Props {
  entry: DashboardRecentInvoice;
  onPress: () => void;
  testID?: string;
}

/**
 * One row in the Dashboard's "Recent invoices" list. Mirrors
 * `InvoiceListRow`'s layout, but reads from the lighter `DashboardRecentInvoice`
 * (no line items, no full `Invoice`) that `DashboardRepository` hands back —
 * see that type's doc comment for why.
 */
export function RecentInvoiceRow({ entry, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open invoice ${entry.invoiceNumber}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.info}>
        <Text style={styles.number} numberOfLines={1}>
          {entry.invoiceNumber}
        </Text>
        <Text style={styles.customer} numberOfLines={1}>
          {entry.customerName}
        </Text>
        <Text style={styles.date}>{formatDate(entry.issueDate)}</Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.total}>{entry.grandTotal.toFixed(2)}</Text>
        <InvoiceStatusBadge status={entry.status} testID={testID ? `${testID}-status` : undefined} />
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
  trailing: { alignItems: 'flex-end', gap: 6 },
  total: { fontSize: 14, fontWeight: '700', color: colors.text },
});
