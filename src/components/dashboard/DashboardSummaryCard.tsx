import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardSummary } from '@/domain/dashboard/types';
import { colors } from '@/theme/colors';

interface Props {
  summary: DashboardSummary;
  testID?: string;
}

/**
 * The Dashboard's 2x2 key-metrics grid (Total Sales / Collected / Outstanding
 * / Overdue) — always rendered from a `DashboardSummary` that was
 * *calculated* by `domain/dashboard/calculations.ts`, never a hard-coded or
 * stored figure. Matches the Stitch "Key Metrics" cards: a label + icon
 * chip, a large value, and one real, derived secondary line per card.
 *
 * The Stitch design also shows a month-over-month "+12.4% vs last mo" trend
 * chip on the Total Sales card. There is no prior-period/historical sales
 * figure anywhere in the schema to compute that from, so it is rendered as a
 * visible "DESIGN ONLY" chip instead of a fabricated percentage.
 */
export function DashboardSummaryCard({ summary, testID }: Props) {
  const collectedPercent = summary.totalSales > 0 ? (summary.totalPaid / summary.totalSales) * 100 : 0;

  return (
    <View style={styles.grid} testID={testID}>
      <View style={styles.row}>
        <MetricTile
          label="Total sales"
          value={formatAmount(summary.totalSales)}
          icon="trending-up"
          iconBg="#E5EEFF"
          iconColor={colors.primary}
          testID="summary-total-sales"
        >
          {/* DESIGN ONLY: no prior-month sales figure exists to compute a real trend from. */}
          <View style={styles.designOnlyChip}>
            <Text style={styles.designOnlyChipText}>DESIGN ONLY</Text>
          </View>
        </MetricTile>
        <MetricTile
          label="Collected"
          value={formatAmount(summary.totalPaid)}
          icon="check-circle"
          iconBg="#DFF7EC"
          iconColor="#0F9D58"
          testID="summary-total-paid"
        >
          <Text style={styles.secondaryText}>{collectedPercent.toFixed(1)}% collected</Text>
        </MetricTile>
      </View>
      <View style={styles.row}>
        <MetricTile
          label="Outstanding"
          value={formatAmount(summary.totalOutstanding)}
          icon="clock"
          iconBg="#E9ECFB"
          iconColor="#565E74"
          emphasis={summary.totalOutstanding > 0}
          testID="summary-total-outstanding"
        >
          <Text style={styles.secondaryText}>{summary.pendingCount} pending</Text>
        </MetricTile>
        <MetricTile
          label="Overdue"
          value={formatAmount(summary.totalOverdue)}
          icon="alert-circle"
          iconBg="#FBE4E2"
          iconColor={colors.danger}
          danger={summary.totalOverdue > 0}
          testID="summary-total-overdue"
        >
          <Text style={[styles.secondaryText, summary.overdueCount > 0 && styles.dangerText]}>
            {summary.overdueCount} overdue
          </Text>
        </MetricTile>
      </View>
    </View>
  );
}

function MetricTile({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  emphasis,
  danger,
  testID,
  children,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  emphasis?: boolean;
  danger?: boolean;
  testID?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.tile} testID={testID}>
      <View style={styles.tileHeader}>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={14} color={iconColor} />
        </View>
      </View>
      <Text style={[styles.tileValue, emphasis && styles.tileValueEmphasis, danger && styles.tileValueDanger]}>
        {value}
      </Text>
      {children}
    </View>
  );
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  iconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 4 },
  tileValueEmphasis: { color: colors.primary },
  tileValueDanger: { color: colors.danger },
  secondaryText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  dangerText: { color: colors.danger },
  designOnlyChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F1F5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  designOnlyChipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
});
