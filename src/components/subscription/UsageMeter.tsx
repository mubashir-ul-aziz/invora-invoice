import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceUsage } from '@/domain/subscription/invoiceAccess';
import { colors } from '@/theme/colors';

interface Props {
  usage: InvoiceUsage | null;
  testID?: string;
}

function formatReset(resetsAt: number): string {
  return new Date(resetsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "3 of 5 invoices used this month" with a progress bar. Renders "Unlimited" for uncapped plans and nothing until usage has loaded. */
export function UsageMeter({ usage, testID }: Props) {
  if (!usage) {
    return null;
  }
  const unlimited = usage.limit === null;
  const ratio = unlimited || usage.limit === 0 ? 0 : Math.min(1, usage.used / (usage.limit as number));
  const atLimit = !unlimited && usage.used >= (usage.limit as number);

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {unlimited
            ? `${usage.used} invoice${usage.used === 1 ? '' : 's'} this month`
            : `${usage.used} of ${usage.limit} invoices used this month`}
        </Text>
        {!unlimited && <Text style={styles.reset}>Resets {formatReset(usage.resetsAt)}</Text>}
      </View>
      {unlimited ? (
        <Text style={styles.unlimited}>Unlimited invoices</Text>
      ) : (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: usage.limit as number, now: usage.used }}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }, atLimit && styles.fillFull]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  reset: { fontSize: 11, color: colors.textMuted },
  unlimited: { fontSize: 12, color: colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  fillFull: { backgroundColor: colors.danger },
});
