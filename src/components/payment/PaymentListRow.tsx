import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Payment } from '@/domain/payment/types';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment/types';
import { colors } from '@/theme/colors';

interface Props {
  payment: Payment;
  onPress?: () => void;
  /** Hidden on Invoice Detail's payment summary, where every row already belongs to the same invoice/customer. */
  showInvoiceAndCustomer?: boolean;
  testID?: string;
}

/** One payment row — used on Payment History, Customer History, and Invoice Detail's payment summary. */
export function PaymentListRow({ payment, onPress, showInvoiceAndCustomer = true, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Payment of ${payment.amount.toFixed(2)}`}
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && !!onPress && styles.pressed]}
    >
      <View style={styles.info}>
        {showInvoiceAndCustomer && (
          <Text style={styles.title} numberOfLines={1}>
            {payment.invoiceNumber} · {payment.customerName}
          </Text>
        )}
        <Text style={styles.date}>{formatDate(payment.paymentDate)}</Text>
        {!!payment.reference && (
          <Text style={styles.reference} numberOfLines={1}>
            Ref: {payment.reference}
          </Text>
        )}
      </View>
      <View style={styles.trailing}>
        <Text style={styles.amount}>{payment.amount.toFixed(2)}</Text>
        <View style={styles.methodBadge}>
          <Text style={styles.methodLabel}>{PAYMENT_METHOD_LABELS[payment.method]}</Text>
        </View>
        {!!onPress && <Text style={styles.editLabel}>Edit</Text>}
      </View>
    </Pressable>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  date: { fontSize: 12, color: colors.textMuted },
  reference: { fontSize: 12, color: colors.textMuted },
  trailing: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.text },
  methodBadge: { backgroundColor: colors.background, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  methodLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  editLabel: { fontSize: 11, fontWeight: '600', color: colors.primary },
});
