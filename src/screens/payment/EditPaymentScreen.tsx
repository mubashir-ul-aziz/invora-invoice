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
import { formValuesToPaymentUpdateInput, paymentToFormDefaults } from '@/domain/payment/formMapping';
import type { Payment, PaymentUpdateInput } from '@/domain/payment/types';
import { paymentFormSchemaWithMinDate, type PaymentFormOutput, type PaymentFormValues } from '@/domain/payment/validation';
import type { RootStackParamList } from '@/navigation/types';
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
  update,
  onDelete,
}: {
  navigation: Props['navigation'];
  payment: Payment;
  summary: InvoicePaymentSummary | null;
  invoiceIssueDate: string | null;
  update: (id: string, input: PaymentUpdateInput) => Promise<Payment>;
  onDelete: () => void;
}) {
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
      <View style={styles.headerCard}>
        <Text style={styles.invoiceNumber}>{payment.invoiceNumber}</Text>
        <Text style={styles.customerName}>{payment.customerName}</Text>
      </View>

      {!!summary && <PaymentSummaryCard summary={summary} testID="edit-payment-summary" />}

      <PaymentFormFields control={control} errors={errors} minPaymentDate={invoiceIssueDate} />

      <ActionButton
        label={isSubmitting ? 'Saving…' : 'Save changes'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting}
        testID="save-payment"
      />
      <ActionButton label="Delete payment" onPress={onDelete} testID="action-delete-payment" />
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
