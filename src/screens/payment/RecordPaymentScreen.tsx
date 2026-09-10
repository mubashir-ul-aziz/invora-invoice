import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { PaymentFormFields } from '@/components/payment/PaymentFormFields';
import { PaymentSummaryCard } from '@/components/payment/PaymentSummaryCard';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { summarizeInvoicePayments, type InvoicePaymentSummary } from '@/domain/payment/calculations';
import { paymentToFormDefaults } from '@/domain/payment/formMapping';
import { paymentFormSchema, type PaymentFormOutput, type PaymentFormValues } from '@/domain/payment/validation';
import type { RootStackParamList } from '@/navigation/types';
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
 */
export function RecordPaymentScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const { getDetail } = useInvoiceStore();
  const { listByInvoice, create } = usePaymentStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detail, setDetail] = useState<InvoiceWithStatus | null>(null);
  const [summary, setSummary] = useState<InvoicePaymentSummary | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues, unknown, PaymentFormOutput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: paymentToFormDefaults(null),
  });

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
        reset(paymentToFormDefaults(null));
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

  const onSubmit = handleSubmit(async (values) => {
    if (!detail) {
      return;
    }
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
    <KeyboardAvoidingScreen style={styles.screen} contentContainerStyle={styles.content} testID="record-payment-screen">
      <View style={styles.headerCard}>
        <Text style={styles.invoiceNumber}>{detail.invoice.invoiceNumber}</Text>
        <Text style={styles.customerName}>{detail.invoice.customerName}</Text>
      </View>

      <PaymentSummaryCard summary={summary} testID="record-payment-summary" />

      <PaymentFormFields control={control} errors={errors} />

      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Record payment'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-payment"
      />
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  invoiceNumber: { fontSize: 16, fontWeight: '700', color: colors.text },
  customerName: { fontSize: 13, color: colors.textMuted },
});
