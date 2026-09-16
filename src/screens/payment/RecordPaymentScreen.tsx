import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import { PaymentFormFields } from '@/components/payment/PaymentFormFields';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { summarizeInvoicePayments, type InvoicePaymentSummary } from '@/domain/payment/calculations';
import { paymentToFormDefaults, todayIsoDate } from '@/domain/payment/formMapping';
import { paymentFormSchemaWithMinDate, type PaymentFormOutput, type PaymentFormValues } from '@/domain/payment/validation';
import type { PaymentInput } from '@/domain/payment/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { usePaymentStore } from '@/state/paymentStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordPayment'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Record Payment. The invoice is fixed by `route.params.invoiceId` (chosen
 * before navigating here); recording a payment never lets the user pick or
 * change which invoice it applies to. The payment summary comes from
 * `summarizeInvoicePayments` — the same centralized calculation Invoice
 * Detail's payment summary and Edit Payment use, computed here from this
 * invoice's own real payment rows. The amount field itself always starts
 * blank (see `paymentToFormDefaults`) rather than prefilled with the
 * remaining balance, so the payer has to type the actual amount instead of
 * accidentally submitting the full balance — and it's **not** capped at that
 * balance either way, since overpayment is allowed rather than blocked (see
 * `domain/payment/validation.ts`).
 *
 * Restyled to match the Stitch "Record Payment" design: a Linked Invoice
 * card (real status badge + total/outstanding, from the same `detail`/
 * `summary` already loaded), `PaymentFormFields`'s card sections, and a
 * sticky bottom "Record £X Payment" button. The Stitch mock's "Send receipt"
 * toggle is DESIGN ONLY — recording a payment never emails anything; the
 * only real receipt-adjacent capability is Invoice PDF Preview's manual
 * "Share via Email" action, which isn't triggered from here.
 *
 * The actual form (`RecordPaymentForm`) only mounts once the invoice has
 * loaded, so its validation schema can be built with the invoice's own
 * `issueDate` as the payment date's lower bound from the very first render —
 * see `paymentFormSchemaWithMinDate` — instead of trying to reactively patch
 * a `useForm` already in flight.
 */
export function RecordPaymentScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const { getDetail } = useInvoiceStore();
  const { listByInvoice, create } = usePaymentStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detail, setDetail] = useState<InvoiceWithStatus | null>(null);
  const [summary, setSummary] = useState<InvoicePaymentSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const found = await getDetail(invoiceId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        const payments = await listByInvoice(invoiceId);
        if (cancelled) {
          return;
        }
        const paymentSummary = summarizeInvoicePayments(found.totals.grandTotal, payments);
        setDetail(found);
        setSummary(paymentSummary);
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
  }, [invoiceId]);

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="record-payment-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="record-payment-not-found">
        <Text style={styles.errorText}>This invoice no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !detail || !summary) {
    return (
      <View style={styles.centered} testID="record-payment-error">
        <Text style={styles.errorText}>Couldn't load this invoice.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <RecordPaymentForm
      navigation={navigation}
      invoiceId={invoiceId}
      detail={detail}
      summary={summary}
      create={create}
    />
  );
}

function RecordPaymentForm({
  navigation,
  invoiceId,
  detail,
  summary,
  create,
}: {
  navigation: Props['navigation'];
  invoiceId: string;
  detail: InvoiceWithStatus;
  summary: InvoicePaymentSummary;
  create: (input: PaymentInput) => Promise<unknown>;
}) {
  const [sendReceipt, setSendReceipt] = useState(true);
  const currencySymbol = useCurrencySymbol();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues, unknown, PaymentFormOutput>({
    resolver: zodResolver(paymentFormSchemaWithMinDate(detail.invoice.issueDate)),
    defaultValues: paymentToFormDefaults(null),
  });

  const liveAmount = useWatch({ control, name: 'amount' });

  const handleFullPay = () => {
    setValue('amount', String(summary.remaining), { shouldValidate: true, shouldDirty: true });
    setValue('paymentDate', todayIsoDate(), { shouldValidate: true, shouldDirty: true });
  };

  const handleHalfPay = () => {
    setValue('amount', String(Math.round((summary.remaining / 2) * 100) / 100), {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue('paymentDate', todayIsoDate(), { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create({
        invoiceId,
        invoiceNumber: detail.invoice.invoiceNumber,
        customerId: detail.invoice.customerId,
        customerName: detail.invoice.customerName,
        amount: values.amount,
        paymentDate: values.paymentDate,
        method: values.method,
        reference: values.reference,
        notes: values.notes,
      });
      navigation.popToTop();
      navigation.navigate('InvoiceDetail', { invoiceId });
    } catch {
      Alert.alert("Couldn't save", 'This payment could not be recorded. Please try again.');
    }
  });

  const amountLabel = typeof liveAmount === 'string' && liveAmount.trim() ? liveAmount.trim() : '0.00';

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingScreen style={styles.scroll} contentContainerStyle={styles.content} testID="record-payment-screen">
        {/* Linked Invoice card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Text style={styles.invoiceNumber}>{detail.invoice.invoiceNumber}</Text>
            <InvoiceStatusBadge status={detail.status} />
          </View>
          <View style={styles.customerRow}>
            <View style={styles.customerIcon}>
              <Feather name="briefcase" size={14} color={colors.primary} />
            </View>
            <Text style={styles.customerName} numberOfLines={1}>
              {detail.invoice.customerName}
            </Text>
          </View>
          <View style={styles.balanceGrid}>
            <View>
              <Text style={styles.balanceLabel}>Total Invoiced</Text>
              <Text style={styles.balanceValue}>{currencySymbol}{summary.grandTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceRight}>
              <Text style={[styles.balanceLabel, summary.remaining > 0 && styles.balanceLabelDue]}>
                {summary.overpaid > 0 ? 'Overpaid' : 'Outstanding Balance'}
              </Text>
              <Text style={[styles.balanceValue, summary.remaining > 0 && styles.balanceValueDue]}>
                {currencySymbol}{(summary.overpaid > 0 ? summary.overpaid : summary.remaining).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <PaymentSummaryCard summary={summary} testID="record-payment-summary" />

        <PaymentFormFields
          control={control}
          errors={errors}
          minPaymentDate={detail.invoice.issueDate}
          onFullPay={handleFullPay}
          onHalfPay={handleHalfPay}
        />

        {/* DESIGN ONLY: recording a payment never sends an email — no receipt-on-save capability exists. */}
        <View style={styles.receiptCard}>
          <View style={styles.receiptLeft}>
            <View style={styles.receiptIcon}>
              <Feather name="mail" size={16} color={colors.primary} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.receiptTitle}>Send receipt · DESIGN ONLY</Text>
              <Text style={styles.receiptCaption} numberOfLines={1}>
                {detail.invoice.customerName} — not sent on save
              </Text>
            </View>
          </View>
          <Switch
            value={sendReceipt}
            onValueChange={setSendReceipt}
            trackColor={{ true: colors.primary, false: colors.border }}
            testID="toggle-send-receipt-design-only"
          />
        </View>
      </KeyboardAvoidingScreen>

      <View style={styles.footer}>
        <ActionButton
          label={isSubmitting ? 'Saving…' : `Record ${currencySymbol}${amountLabel} Payment`}
          variant="primary"
          icon="check"
          onPress={onSubmit}
          disabled={isSubmitting}
          testID="save-payment"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
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
  invoiceNumber: { fontSize: 17, fontWeight: '700', color: colors.text },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customerIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  customerName: { fontSize: 13, fontWeight: '600', color: colors.text },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
  },
  balanceRight: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 11, color: colors.textMuted },
  balanceLabelDue: { color: colors.danger },
  balanceValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  balanceValueDue: { color: colors.danger, fontWeight: '700' },

  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  receiptLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  receiptIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  receiptTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  receiptCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  footer: { padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
