import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { INVOICE_STATUS_LABELS } from '@/domain/invoice/status';
import type { InvoiceStatus } from '@/domain/invoice/types';
import { colors } from '@/theme/colors';

interface Props {
  status: InvoiceStatus;
  testID?: string;
}

/** Exported so other invoice-status displays (e.g. the Dashboard's recent-invoices row) can match this badge's palette instead of redefining it. */
export const STATUS_BACKGROUND: Record<InvoiceStatus, string> = {
  unpaid: '#EEF0F5',
  partial: '#FFF3D6',
  paid: '#E3F3E8',
  overdue: '#FBE4E2',
};

export const STATUS_TEXT: Record<InvoiceStatus, string> = {
  unpaid: colors.textMuted,
  partial: '#8A6D1D',
  paid: '#1E7B41',
  overdue: colors.danger,
};

/** A small colored pill for an invoice's computed status — never a stored field, see `domain/invoice/status.ts`. */
export function InvoiceStatusBadge({ status, testID }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_BACKGROUND[status] }]} testID={testID}>
      <Text style={[styles.label, { color: STATUS_TEXT[status] }]}>{INVOICE_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '700' },
});
