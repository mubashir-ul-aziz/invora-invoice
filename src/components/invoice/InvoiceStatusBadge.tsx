import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { INVOICE_STATUS_LABELS } from '@/domain/invoice/status';
import type { InvoiceStatus } from '@/domain/invoice/types';
import { colors } from '@/theme/colors';

interface Props {
  status: InvoiceStatus;
  testID?: string;
  /** Overrides the badge's default `alignSelf: 'flex-start'` — e.g. `flex-end` when it's the last item in a right-aligned trailing column. */
  style?: StyleProp<ViewStyle>;
}

/** Exported so other invoice-status displays (e.g. the Dashboard's recent-invoices row) can match this badge's palette instead of redefining it. Sourced from the shared Kinetic Ledger status tokens (`theme/colors.ts`) so every status indicator in the app stays in sync. */
export const STATUS_BACKGROUND: Record<InvoiceStatus, string> = {
  unpaid: colors.lockedBg,
  partial: colors.warningBg,
  paid: colors.successBg,
  overdue: colors.dangerBg,
};

export const STATUS_TEXT: Record<InvoiceStatus, string> = {
  unpaid: colors.textMuted,
  partial: colors.warning,
  paid: colors.success,
  overdue: colors.danger,
};

/** A small colored pill for an invoice's computed status — never a stored field, see `domain/invoice/status.ts`. */
export function InvoiceStatusBadge({ status, testID, style }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_BACKGROUND[status] }, style]} testID={testID}>
      <Text style={[styles.label, { color: STATUS_TEXT[status] }]}>{INVOICE_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '700' },
});
