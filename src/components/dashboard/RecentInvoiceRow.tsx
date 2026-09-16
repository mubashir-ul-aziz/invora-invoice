import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_BACKGROUND, STATUS_TEXT } from '@/components/invoice/InvoiceStatusBadge';
import type { DashboardRecentInvoice } from '@/domain/dashboard/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

interface Props {
  entry: DashboardRecentInvoice;
  onPress: () => void;
  testID?: string;
}

const STATUS_ICON: Record<DashboardRecentInvoice['status'], keyof typeof Feather.glyphMap> = {
  overdue: 'alert-circle',
  partial: 'pie-chart',
  unpaid: 'clock',
  paid: 'check-circle',
};

/**
 * One row in the Dashboard's "Recent invoices" list, matching the Stitch
 * design's status icon + due/issue-date + trailing total/badge layout.
 * Reads from the lighter `DashboardRecentInvoice` (no line items, no full
 * `Invoice`) that `DashboardRepository` hands back.
 *
 * The Stitch mock labels a paid row with the date it was paid (e.g.
 * "Paid 18 Oct") — this app doesn't join payment dates into the dashboard
 * query (see `DashboardInvoiceEntry`'s doc comment on why it's deliberately
 * narrow), so a paid row shows its real issue date instead of a fabricated
 * paid-on date.
 */
export function RecentInvoiceRow({ entry, onPress, testID }: Props) {
  const dateLabel = describeDate(entry);
  const showProgress = entry.status === 'partial' && entry.grandTotal > 0;
  const progressPercent = showProgress ? Math.min(100, (entry.amountPaid / entry.grandTotal) * 100) : 0;
  const currencySymbol = useCurrencySymbol();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open invoice ${entry.invoiceNumber}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: STATUS_BACKGROUND[entry.status] }]}>
        <Feather name={STATUS_ICON[entry.status]} size={18} color={STATUS_TEXT[entry.status]} />
      </View>
      <View style={styles.info}>
        <Text style={styles.customer} numberOfLines={1}>
          {entry.customerName}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.number} numberOfLines={1}>
            {entry.invoiceNumber}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={[styles.date, dateLabel.danger && styles.dateDanger]} numberOfLines={1}>
            {dateLabel.text}
          </Text>
        </View>
        {showProgress && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
      </View>
      <View style={styles.trailing}>
        <Text style={styles.total}>{currencySymbol}{entry.grandTotal.toFixed(2)}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_BACKGROUND[entry.status] }]}>
          <Text style={[styles.badgeText, { color: STATUS_TEXT[entry.status] }]} numberOfLines={1}>
            {badgeLabel(entry, currencySymbol)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function badgeLabel(entry: DashboardRecentInvoice, currencySymbol: string): string {
  if (entry.status === 'partial') {
    return `Part (${currencySymbol}${entry.amountPaid.toFixed(2)} pd)`;
  }
  return { unpaid: 'Unpaid', paid: 'Paid', overdue: 'Overdue' }[entry.status];
}

function describeDate(entry: DashboardRecentInvoice): { text: string; danger?: boolean } {
  if (entry.status === 'overdue' && entry.dueDate) {
    return { text: `Due ${formatShortDate(entry.dueDate)}`, danger: true };
  }
  if ((entry.status === 'unpaid' || entry.status === 'partial') && entry.dueDate) {
    const isToday = entry.dueDate === todayIso();
    return { text: isToday ? 'Due Today' : `Due ${formatShortDate(entry.dueDate)}` };
  }
  return { text: `Issued ${formatShortDate(entry.issueDate)}` };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.7 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2, minWidth: 0 },
  customer: { fontSize: 14, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  number: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  metaDot: { fontSize: 12, color: colors.textMuted },
  date: { fontSize: 12, color: colors.textMuted },
  dateDanger: { color: colors.danger, fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.background, marginTop: 4, width: 96, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  trailing: { alignItems: 'flex-end', gap: 5 },
  total: { fontSize: 14, fontWeight: '700', color: colors.text },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, maxWidth: 110 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
