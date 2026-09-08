import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardSummary } from '@/domain/dashboard/types';
import { colors } from '@/theme/colors';

interface Props {
  summary: DashboardSummary;
  testID?: string;
}

/**
 * The five numbers Phase 8's brief asks the Dashboard to show — always
 * rendered from a `DashboardSummary` that was *calculated* by
 * `domain/dashboard/calculations.ts`, never a hard-coded or stored figure.
 * Mirrors `CustomerSummaryCard`'s "never sums, only renders what it's handed"
 * tile layout.
 */
export function DashboardSummaryCard({ summary, testID }: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.row}>
        <SummaryTile label="Total sales" value={formatAmount(summary.totalSales)} testID="summary-total-sales" />
        <SummaryTile label="Paid" value={formatAmount(summary.totalPaid)} testID="summary-total-paid" />
      </View>
      <View style={styles.row}>
        <SummaryTile
          label="Outstanding"
          value={formatAmount(summary.totalOutstanding)}
          emphasis={summary.totalOutstanding > 0}
          testID="summary-total-outstanding"
        />
        <SummaryTile
          label="Overdue"
          value={formatAmount(summary.totalOverdue)}
          danger={summary.totalOverdue > 0}
          testID="summary-total-overdue"
        />
      </View>
      <SummaryTile label="Invoices" value={String(summary.invoiceCount)} testID="summary-invoice-count" />
    </View>
  );
}

function SummaryTile({
  label,
  value,
  emphasis,
  danger,
  testID,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.tile} testID={testID}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, emphasis && styles.tileValueEmphasis, danger && styles.tileValueDanger]}>
        {value}
      </Text>
    </View>
  );
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 4 },
  tileLabel: { fontSize: 12, color: colors.textMuted },
  tileValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  tileValueEmphasis: { color: colors.primary },
  tileValueDanger: { color: colors.danger },
});
