import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { InvoiceLineRow } from '@/components/invoice/InvoiceLineRow';
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge';
import { InvoiceTotalsSummary } from '@/components/invoice/InvoiceTotalsSummary';
import type { Customer } from '@/domain/customer/types';
import type { Invoice } from '@/domain/invoice/types';
import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerStore } from '@/state/customerStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/** Falls back to the invoice's own name snapshot if the customer contact can no longer be found. */
function customerFromInvoiceSnapshot(invoice: Invoice): Customer {
  return {
    id: invoice.customerId,
    name: invoice.customerName,
    phone: null,
    email: null,
    address: null,
    notes: null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function InvoiceDetailScreen({ navigation, route }: Props) {
  const { invoiceId } = route.params;
  const { getDetail, remove } = useInvoiceStore();
  const { getById: getCustomerById } = useCustomerStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detail, setDetail] = useState<InvoiceWithStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const result = await getDetail(invoiceId);
        if (cancelled) {
          return;
        }
        if (!result) {
          setStatus('not-found');
          return;
        }
        setDetail(result);
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

  const notBuiltYet = (feature: string) =>
    Alert.alert('Coming soon', `${feature} will be available once that functionality is built.`);

  const handleDuplicate = async () => {
    if (!detail) {
      return;
    }
    const customer = (await getCustomerById(detail.invoice.customerId)) ?? customerFromInvoiceSnapshot(detail.invoice);
    useInvoiceDraftStore.getState().startDuplicate(detail.invoice, customer);
    navigation.navigate('InvoiceReview');
  };

  const handleDelete = () => {
    if (!detail) {
      return;
    }
    Alert.alert(
      'Delete invoice',
      `Delete invoice "${detail.invoice.invoiceNumber}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(detail.invoice.id);
              navigation.goBack();
            } catch {
              Alert.alert("Couldn't delete", 'This invoice could not be deleted. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="invoice-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="invoice-detail-not-found">
        <Text style={styles.errorText}>This invoice no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <View style={styles.centered} testID="invoice-detail-error">
        <Text style={styles.errorText}>Couldn't load this invoice.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const { invoice, totals, status: invoiceStatus } = detail;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="invoice-detail-screen">
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <InvoiceStatusBadge status={invoiceStatus} testID="invoice-detail-status" />
        </View>
        <SummaryRow label="Customer" value={invoice.customerName} />
        <SummaryRow label="Invoice type" value={getInvoiceTypeDefinition(invoice.invoiceTypeId).label} />
        <SummaryRow label="Invoice date" value={formatDate(invoice.issueDate)} />
        {!!invoice.dueDate && <SummaryRow label="Due date" value={formatDate(invoice.dueDate)} />}
      </View>

      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>Items</Text>
        {invoice.items.map((line) => (
          <InvoiceLineRow
            key={line.id}
            itemName={line.itemName}
            quantity={line.quantity}
            unit={line.unit}
            unitPrice={line.unitPrice}
            lineTotal={line.lineTotal}
            testID={`invoice-detail-line-${line.id}`}
          />
        ))}
      </View>

      <InvoiceTotalsSummary totals={totals} testID="invoice-detail-totals" />

      {!!invoice.notes && (
        <View style={styles.textCard}>
          <Text style={styles.textLabel}>Notes</Text>
          <Text style={styles.textValue}>{invoice.notes}</Text>
        </View>
      )}
      {!!invoice.terms && (
        <View style={styles.textCard}>
          <Text style={styles.textLabel}>Terms</Text>
          <Text style={styles.textValue}>{invoice.terms}</Text>
        </View>
      )}

      <View style={styles.row}>
        <ActionButton
          label="Edit invoice"
          variant="primary"
          onPress={() => navigation.navigate('EditInvoice', { invoiceId })}
          testID="action-edit-invoice"
        />
        <ActionButton label="Duplicate" onPress={handleDuplicate} testID="action-duplicate-invoice" />
      </View>
      <View style={styles.row}>
        <ActionButton
          label="Record payment"
          onPress={() => notBuiltYet('Recording payments')}
          testID="action-record-payment"
        />
        <ActionButton label="Share / PDF" onPress={() => notBuiltYet('Invoice PDF sharing')} testID="action-share" />
      </View>
      <ActionButton label="Delete invoice" onPress={handleDelete} testID="action-delete-invoice" />
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNumber: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  itemsSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  textCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  textLabel: { fontSize: 12, color: colors.textMuted },
  textValue: { fontSize: 13, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
