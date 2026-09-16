import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Payment, PaymentMethod } from '@/domain/payment/types';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

interface Props {
  payment: Payment;
  onPress?: () => void;
  /** Hidden on Invoice Detail's payment summary, where every row already belongs to the same invoice/customer. */
  showInvoiceAndCustomer?: boolean;
  testID?: string;
}

/** Per-method icon + tint — same "one deterministic mapping per enum value" convention as `ItemListRow`'s `METHOD_STYLE`. Exported so other payment-method displays (e.g. `PaymentFormFields`'s method picker) reuse the same mapping. */
export const METHOD_STYLE: Record<PaymentMethod, { icon: keyof typeof Feather.glyphMap; bg: string; fg: string }> = {
  cash: { icon: 'dollar-sign', bg: '#DBFCEC', fg: '#006243' },
  bank_transfer: { icon: 'repeat', bg: '#DAE2FD', fg: '#3F465C' },
  card: { icon: 'credit-card', bg: '#E5EEFF', fg: colors.primary },
  paypal: { icon: 'globe', bg: '#DCE9FF', fg: '#003EA8' },
  other: { icon: 'more-horizontal', bg: '#EEF0F5', fg: colors.textMuted },
};

/**
 * One payment row — used on Payment History, Customer History, and Invoice
 * Detail's payment summary. Restyled to match the Stitch "Payment History"
 * ledger card: a per-method icon, invoice/customer title (unchanged text —
 * `"{invoiceNumber} · {customerName}"`, asserted directly by
 * `PaymentHistoryScreen.test.tsx`), a method + date subtitle, and the amount
 * (unchanged plain `.toFixed(2)` text, same test) with a separate "+" sibling
 * rather than concatenating it into the amount string.
 *
 * The Stitch mock's per-row "Settled / Partial / Paid in Full" status badge
 * describes the *invoice's* status at view time, not the payment itself —
 * computing that per row would mean an extra invoice lookup per payment
 * (Payment History can list every payment across every invoice), so it
 * isn't reproduced here; the method badge below already gives each row a
 * real, payment-level category.
 */
export function PaymentListRow({ payment, onPress, showInvoiceAndCustomer = true, testID }: Props) {
  const methodStyle = METHOD_STYLE[payment.method];
  const currencySymbol = useCurrencySymbol();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Payment of ${currencySymbol}${payment.amount.toFixed(2)}`}
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && !!onPress && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: methodStyle.bg }]}>
        <Feather name={methodStyle.icon} size={18} color={methodStyle.fg} />
      </View>
      <View style={styles.info}>
        {showInvoiceAndCustomer && (
          <Text style={styles.title} numberOfLines={1}>
            {payment.invoiceNumber} · {payment.customerName}
          </Text>
        )}
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {PAYMENT_METHOD_LABELS[payment.method]}
          </Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {formatDate(payment.paymentDate)}
          </Text>
        </View>
        {!!payment.reference && (
          <Text style={styles.reference} numberOfLines={1}>
            Ref: {payment.reference}
          </Text>
        )}
      </View>
      <View style={styles.trailing}>
        <View style={styles.amountRow}>
          <Text style={styles.amountSign}>+{currencySymbol}</Text>
          <Text style={styles.amount}>{payment.amount.toFixed(2)}</Text>
        </View>
        {!!onPress && (
          <View style={styles.editRow}>
            <Text style={styles.editLabel}>Edit</Text>
            <Feather name="chevron-right" size={12} color={colors.primary} />
          </View>
        )}
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
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subtitle: { fontSize: 12, color: colors.textMuted },
  dot: { fontSize: 12, color: colors.textMuted },
  reference: { fontSize: 11, color: colors.textMuted },
  trailing: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  amountSign: { fontSize: 14, fontWeight: '700', color: colors.text },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  editLabel: { fontSize: 11, fontWeight: '600', color: colors.primary },
});
