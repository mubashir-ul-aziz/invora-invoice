import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoicePaymentSummary } from '@/domain/payment/calculations';
import { colors } from '@/theme/colors';

interface Props {
  summary: InvoicePaymentSummary;
  testID?: string;
}

/**
 * Invoice Detail's "Invoice payment summary" section — Paid and either
 * Remaining or, in the overpayment case, a distinct "Overpaid" line, never a
 * negative "Remaining" number. Fed an `InvoicePaymentSummary` computed once by
 * `domain/payment/calculations.ts`; this component never sums payments
 * itself, mirroring how `InvoiceTotalsSummary` never sums invoice lines.
 */
export function PaymentSummaryCard({ summary, testID }: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <Row label="Invoice total" value={summary.grandTotal} testID="payment-summary-total" />
      <Row label="Paid" value={summary.amountPaid} testID="payment-summary-paid" />
      {summary.overpaid > 0 ? (
        <Row label="Overpaid" value={summary.overpaid} emphasis testID="payment-summary-overpaid" />
      ) : (
        <Row label="Remaining" value={summary.remaining} emphasis testID="payment-summary-remaining" />
      )}
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
      <Text style={[styles.value, emphasis && styles.emphasisValue]}>{value.toFixed(2)}</Text>
    </View>
  );
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
});
