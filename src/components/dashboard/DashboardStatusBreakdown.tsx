import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardSummary } from '@/domain/dashboard/types';
import { colors } from '@/theme/colors';

interface Props {
  summary: DashboardSummary;
  testID?: string;
}

const PAID_COLOR = '#0F9D58';
const PENDING_COLOR = colors.primary;
const OVERDUE_COLOR = colors.danger;

/**
 * Multi-segment "Status Breakdown" strip from the Stitch design — every
 * number here (paid/pending/overdue counts, total) comes straight from
 * `DashboardSummary`, which `summarizeDashboard()` already derives from real
 * invoice data (see that function's per-status counters). No invented data.
 */
export function DashboardStatusBreakdown({ summary, testID }: Props) {
  const total = summary.invoiceCount;
  const paidPercent = total > 0 ? (summary.paidCount / total) * 100 : 0;
  const pendingPercent = total > 0 ? (summary.pendingCount / total) * 100 : 0;
  const overduePercent = total > 0 ? (summary.overdueCount / total) * 100 : 0;

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>Status breakdown</Text>
        <Text style={styles.totalText}>{total} total invoices</Text>
      </View>
      <View style={styles.track}>
        {paidPercent > 0 && <View style={[styles.segment, { width: `${paidPercent}%`, backgroundColor: PAID_COLOR }]} />}
        {pendingPercent > 0 && (
          <View style={[styles.segment, { width: `${pendingPercent}%`, backgroundColor: PENDING_COLOR }]} />
        )}
        {overduePercent > 0 && (
          <View style={[styles.segment, { width: `${overduePercent}%`, backgroundColor: OVERDUE_COLOR }]} />
        )}
      </View>
      <View style={styles.legend}>
        <LegendItem color={PAID_COLOR} label={`Paid (${summary.paidCount})`} />
        <LegendItem color={PENDING_COLOR} label={`Pending (${summary.pendingCount})`} />
        <LegendItem color={OVERDUE_COLOR} label={`Late (${summary.overdueCount})`} />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '600', color: colors.text },
  totalText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: 'hidden',
    gap: 2,
  },
  segment: { height: '100%' },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
});
