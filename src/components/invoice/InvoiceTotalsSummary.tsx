import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceTotals } from '@/domain/invoice/calculations';
import { colors } from '@/theme/colors';

interface Props {
  totals: InvoiceTotals;
  testID?: string;
}

/**
 * Renders whatever `InvoiceTotals` it's handed — it never sums lines or
 * applies a discount/tax rate itself. Per `MVP_BUILD_PLAN.md` §3, all of that
 * math lives in `domain/invoice/calculations.ts`; this component is display
 * only, used on both the not-yet-saved Review screen (fed a live preview)
 * and Invoice Detail (fed the frozen historical totals).
 */
export function InvoiceTotalsSummary({ totals, testID }: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <Row label="Subtotal" value={totals.subtotal} testID="totals-subtotal" />
      {totals.discountTotal > 0 && (
        <Row label="Discount" value={-totals.discountTotal} testID="totals-discount" />
      )}
      {totals.taxTotal > 0 && <Row label="Tax" value={totals.taxTotal} testID="totals-tax" />}
      <View style={styles.divider} />
      <Row label="Grand total" value={totals.grandTotal} emphasis testID="totals-grand-total" />
    </View>
  );
}

function Row({
  label,
  value,
  emphasis,
  testID,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={[styles.label, emphasis && styles.emphasisLabel]}>{label}</Text>
      <Text style={[styles.value, emphasis && styles.emphasisValue]}>{formatAmount(value)}</Text>
    </View>
  );
}

function formatAmount(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 13, color: colors.text },
  emphasisLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  emphasisValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border },
});
