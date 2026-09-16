import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import { PaymentFormFields } from '@/components/payment/PaymentFormFields';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { summarizeInvoicePayments, type InvoicePaymentSummary } from '@/domain/payment/calculations';
import { formValuesToPaymentUpdateInput, paymentToFormDefaults } from '@/domain/payment/formMapping';
import type { Payment, PaymentUpdateInput } from '@/domain/payment/types';
import type { InvoiceStatus } from '@/domain/invoice/types';
import { formatTimestamp } from '@/domain/shared/formatting';
import { paymentFormSchemaWithMinDate, type PaymentFormOutput, type PaymentFormValues } from '@/domain/payment/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useInvoiceStore } from '@/state/invoiceStore';
import { usePaymentStore } from '@/state/paymentStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditPayment'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Edit Payment. The invoice this payment belongs to is fixed — see the doc
 * comment on `PaymentUpdateInput` — so, like Edit Invoice's customer/type,
 * it's shown but never editable here. The payment summary shown is the
 * invoice's real current one (via `summarizeInvoicePayments`, the same
 * centralized calculation every other payment-summary screen uses).
 *
 * Restyled to match the Stitch "Edit Payment" design: a Payment Metadata
 * card (real invoice status badge, reference, "Recorded {date}", a link to
 * Invoice Detail), a Settlement Ledger card built from the same real
 * `summary` `PaymentSummaryCard` already renders, `PaymentFormFields`'s card
 * sections, and a Danger Zone. Two Stitch elements aren't reproduced because
 * they're fabricated relative to real data: the "Reconciled" badge and the
 * "Apex Admin" author name (no reconciliation concept or multi-user
 * attribution exists anywhere in this app) — dropped rather than badged,
 * same reasoning as Invoice Review's compliance-claim copy. The Notes
 * field's "Visible on client receipt statement" claim also isn't
 * reproduced — payment notes are never rendered into any PDF/receipt.
 *
 * The actual form (`EditPaymentForm`) only mounts once the invoice's own
 * `issueDate` has loaded, so `paymentFormSchemaWithMinDate` can be built with
 * that lower bound from the very first render — same pattern as
 * `RecordPaymentScreen`.
 */
export function EditPaymentScreen({ navigation, route }: Props) {
  const { paymentId } = route.params;
  const { getById, listByInvoice, update, remove } = usePaymentStore();
  const { getDetail } = useInvoiceStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [summary, setSummary] = useState<InvoicePaymentSummary | null>(null);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const found = await getById(paymentId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        const [detail, allPayments] = await Promise.all([getDetail(found.invoiceId), listByInvoice(found.invoiceId)]);
        if (cancelled) {
          return;
        }
        if (detail) {
          setSummary(summarizeInvoicePayments(detail.totals.grandTotal, allPayments));
          setInvoiceIssueDate(detail.invoice.issueDate);
          setInvoiceStatus(detail.status);
        }
        setPayment(found);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const handleDelete = () => {
    if (!payment) {
      return;
    }
    Alert.alert('Delete payment', 'Delete this payment record? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const invoiceId = payment.invoiceId;
            await remove(payment.id);
            navigation.popToTop();
            navigation.navigate('InvoiceDetail', { invoiceId });
          } catch {
            Alert.alert("Couldn't delete", 'This payment could not be deleted. Please try again.');
          }
        },
      },
    ]);
  };

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="edit-payment-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="edit-payment-not-found">
        <Text style={styles.errorText}>This payment no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !payment) {
    return (
      <View style={styles.centered} testID="edit-payment-error">
        <Text style={styles.errorText}>Couldn't load this payment.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <EditPaymentForm
      navigation={navigation}
      payment={payment}
      summary={summary}
      invoiceIssueDate={invoiceIssueDate}
      invoiceStatus={invoiceStatus}
      update={update}
      onDelete={handleDelete}
    />
  );
}

function EditPaymentForm({
  navigation,
  payment,
  summary,
  invoiceIssueDate,
  invoiceStatus,
  update,
  onDelete,
}: {
  navigation: Props['navigation'];
  payment: Payment;
  summary: InvoicePaymentSummary | null;
  invoiceIssueDate: string | null;
  invoiceStatus: InvoiceStatus | null;
  update: (id: string, input: PaymentUpdateInput) => Promise<Payment>;
  onDelete: () => void;
}) {
  const currencySymbol = useCurrencySymbol();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues, unknown, PaymentFormOutput>({
    resolver: zodResolver(paymentFormSchemaWithMinDate(invoiceIssueDate)),
    defaultValues: paymentToFormDefaults(payment),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update(payment.id, formValuesToPaymentUpdateInput(values));
      navigation.popToTop();
      navigation.navigate('InvoiceDetail', { invoiceId: payment.invoiceId });
    } catch {
      Alert.alert("Couldn't save", 'Your changes could not be saved. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen style={styles.screen} contentContainerStyle={styles.content} testID="edit-payment-screen">
      {/* Payment Metadata card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          {invoiceStatus ? <InvoiceStatusBadge status={invoiceStatus} /> : <View />}
          {!!payment.reference && (
            <View style={styles.refBadge}>
              <Text style={styles.refBadgeText} numberOfLines={1}>
                Ref: {payment.reference}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open invoice ${payment.invoiceNumber}`}
          testID="action-open-invoice"
          onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: payment.invoiceId })}
          style={({ pressed }) => [styles.clientRow, pressed && styles.pressed]}
        >
          <View style={styles.clientLeft}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{payment.customerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.customerName} numberOfLines={1}>
                {payment.customerName}
              </Text>
              <Text style={styles.invoiceNumber} numberOfLines={1}>
                {payment.invoiceNumber}
              </Text>
            </View>
          </View>
          <Feather name="external-link" size={16} color={colors.primary} />
        </Pressable>

        <Text style={styles.recordedText}>Recorded {formatTimestamp(payment.createdAt)}</Text>
      </View>

      {/* Settlement Ledger */}
      {!!summary && (
        <View style={styles.ledgerCard}>
          <Text style={styles.ledgerTitle}>Settlement Ledger</Text>
          <View style={styles.ledgerGrid}>
            <View style={styles.ledgerCell}>
              <Text style={styles.ledgerCellLabel}>Invoiced</Text>
              <Text style={styles.ledgerCellValue}>{currencySymbol}{summary.grandTotal.toFixed(2)}</Text>
            </View>
            <View style={[styles.ledgerCell, styles.ledgerCellPrimary]}>
              <Text style={styles.ledgerCellLabelPrimary}>Paid</Text>
              <Text style={styles.ledgerCellValuePrimary}>{currencySymbol}{summary.amountPaid.toFixed(2)}</Text>
            </View>
            <View style={styles.ledgerCell}>
              <Text style={styles.ledgerCellLabel}>{summary.overpaid > 0 ? 'Overpaid' : 'Balance'}</Text>
              <Text style={[styles.ledgerCellValue, summary.remaining > 0 && styles.ledgerCellValueDue]}>
                {currencySymbol}{(summary.overpaid > 0 ? summary.overpaid : summary.remaining).toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Payment Progress</Text>
              <Text style={styles.progressPercent}>
                {summary.grandTotal > 0 ? Math.min(100, Math.round((summary.amountPaid / summary.grandTotal) * 100)) : 0}% settled
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${summary.grandTotal > 0 ? Math.min(100, Math.round((summary.amountPaid / summary.grandTotal) * 100)) : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {!!summary && <PaymentSummaryCard summary={summary} testID="edit-payment-summary" />}

      <Text style={styles.originalNote}>
        Original recorded receipt was {currencySymbol}{payment.amount.toFixed(2)} on {formatDate(payment.paymentDate)}.
      </Text>

      <PaymentFormFields control={control} errors={errors} minPaymentDate={invoiceIssueDate} />

      {/* Danger Zone */}
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeaderRow}>
          <View style={styles.dangerIcon}>
            <Feather name="alert-triangle" size={18} color={colors.danger} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.dangerTitle}>Destructive Action</Text>
            <Text style={styles.dangerCaption}>
              Deleting this payment reopens the invoice's remaining balance by {currencySymbol}{payment.amount.toFixed(2)}.
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete payment"
          testID="action-delete-payment"
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={18} color={colors.danger} />
          <Text style={styles.deleteButtonText}>Void &amp; Delete Payment</Text>
        </Pressable>
      </View>

      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save changes'}
        variant="primary"
        icon="check"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-payment"
      />
    </KeyboardAvoidingScreen>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refBadge: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  refBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
  },
  clientLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  clientAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DAE2FD', alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { fontSize: 14, fontWeight: '700', color: '#3F465C' },
  customerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  invoiceNumber: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 1 },
  recordedText: { fontSize: 11, color: colors.textMuted },

  ledgerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ledgerTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  ledgerGrid: { flexDirection: 'row', gap: 8 },
  ledgerCell: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 10, gap: 3 },
  ledgerCellPrimary: { backgroundColor: colors.primary },
  ledgerCellLabel: { fontSize: 11, color: colors.textMuted },
  ledgerCellLabelPrimary: { fontSize: 11, color: colors.primaryText, opacity: 0.85 },
  ledgerCellValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  ledgerCellValuePrimary: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  ledgerCellValueDue: { color: colors.danger },
  progressSection: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11, color: colors.textMuted },
  progressPercent: { fontSize: 11, fontWeight: '700', color: colors.text },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },

  originalNote: { fontSize: 11, color: colors.textMuted, marginTop: -6 },

  dangerCard: { backgroundColor: '#FBE4E2', borderRadius: 16, padding: 16, gap: 12 },
  dangerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5C6C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.danger },
  dangerCaption: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  deleteButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5C6C1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.danger },
});
