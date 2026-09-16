import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InvoiceStatusBadge, STATUS_BACKGROUND, STATUS_TEXT } from '@/components/invoice/InvoiceStatusBadge';
import { useCurrencySymbol } from '@/state/currencyContext';
import type { InvoiceWithStatus } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

interface Props {
  entry: InvoiceWithStatus;
  onPress: () => void;
  testID?: string;
}

/** Per-status icon, matching the Stitch mock's varied per-row status icons — driven by the same computed `status` the badge uses. */
const STATUS_ICON: Record<InvoiceWithStatus['status'], keyof typeof Feather.glyphMap> = {
  overdue: 'alert-circle',
  partial: 'clock',
  unpaid: 'clock',
  paid: 'check-circle',
};

/**
 * One row on the Invoice List screen, restyled to match the Stitch "Invoice
 * List" card: a status icon, customer name, invoice number + due date (or,
 * for a paid invoice, its issue date — see below), the grand total, a
 * status badge, and — for a partially-paid invoice — a real progress bar.
 *
 * Stitch's paid rows show an exact "Paid 18 Oct" date. `Invoice`/
 * `InvoiceWithStatus` has no stored payment date at this row's granularity
 * (only the summed `amountPaid` — the actual payment records/dates live in
 * Payment History, a per-invoice lookup this list would have to do once per
 * row to reproduce exactly). Rather than fabricate that date, a paid row
 * shows its real issue date instead, labeled "Issued".
 */
export function InvoiceListRow({ entry, onPress, testID }: Props) {
  const { invoice, status, totals, amountPaid } = entry;
  const iconStyle = { backgroundColor: STATUS_BACKGROUND[status], color: STATUS_TEXT[status] };
  const remaining = Math.max(0, totals.grandTotal - amountPaid);
  const showProgress = status !== 'paid' && amountPaid > 0 && totals.grandTotal > 0;
  const currencySymbol = useCurrencySymbol();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open invoice ${invoice.invoiceNumber}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.leading}>
          <View style={[styles.icon, { backgroundColor: iconStyle.backgroundColor }]}>
            <Feather name={STATUS_ICON[status]} size={18} color={iconStyle.color} />
          </View>
          <View style={styles.info}>
            <Text style={styles.customer} numberOfLines={1}>
              {invoice.customerName}
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.number}>{invoice.invoiceNumber}</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={[styles.dateText, status === 'overdue' && styles.dateOverdue]}>
                {formatDetailDate(entry)}
              </Text>
            </View>
            {showProgress && (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, Math.round((amountPaid / totals.grandTotal) * 100))}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressCaption}>
                  Paid {currencySymbol}{amountPaid.toFixed(2)} of {currencySymbol}{totals.grandTotal.toFixed(2)}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.trailing}>
          <Text style={styles.total}>{currencySymbol}{totals.grandTotal.toFixed(2)}</Text>
          {showProgress && <Text style={styles.remainsCaption}>{currencySymbol}{remaining.toFixed(2)} remains</Text>}
          <InvoiceStatusBadge
            status={status}
            testID={testID ? `${testID}-status` : undefined}
            style={styles.statusBadge}
          />
        </View>
      </View>
    </Pressable>
  );
}

function formatDetailDate(entry: InvoiceWithStatus): string {
  const { invoice, status } = entry;
  if (status === 'paid') {
    return `Issued ${formatShortDate(invoice.issueDate)}`;
  }
  if (!invoice.dueDate) {
    return 'No due date';
  }
  const today = new Date().toISOString().slice(0, 10);
  if (invoice.dueDate === today) {
    return 'Due Today';
  }
  return `Due ${formatShortDate(invoice.dueDate)}`;
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  leading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  info: { flex: 1, minWidth: 0, gap: 3 },
  customer: { fontSize: 15, fontWeight: '700', color: colors.text },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dot: { fontSize: 12, color: colors.textMuted },
  dateText: { fontSize: 12, color: colors.textMuted },
  dateOverdue: { color: colors.danger, fontWeight: '700' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.background, overflow: 'hidden', marginTop: 6, maxWidth: 160 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressCaption: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  trailing: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  statusBadge: { alignSelf: 'flex-end' },
  total: { fontSize: 16, fontWeight: '700', color: colors.text },
  remainsCaption: { fontSize: 10, color: colors.textMuted },
});
