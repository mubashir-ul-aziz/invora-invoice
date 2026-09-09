import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CustomerSummaryCard } from '@/components/customer/CustomerSummaryCard';
import { InvoiceListRow } from '@/components/invoice/InvoiceListRow';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import type { Customer } from '@/domain/customer/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import { formatTimestamp } from '@/domain/shared/formatting';
import { openEmail, openGoogleMaps, openPhone, openWebsite, openWhatsApp } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerActivityStore } from '@/state/customerActivityStore';
import { useCustomerStore } from '@/state/customerStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Customer Detail: contact info, the calculated balance summary (see
 * `CustomerSummaryCard`), and the actions the brief asks for. "Create
 * Invoice" seeds `invoiceDraftStore` with this customer already selected and
 * jumps straight to the items step, skipping the customer-picker screen
 * entirely. "Record payment" (Phase 7) opens `InvoiceList` in picker mode,
 * scoped to this customer's own invoices (a payment always belongs to one
 * invoice, so it has to be picked first) — selecting one forwards into
 * `RecordPayment` with that invoice fixed.
 */
export function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { getById } = useCustomerStore();
  const { summary, load: loadActivity } = useCustomerActivityStore();
  const { listForCustomer } = useInvoiceStore();
  const { selection: invoiceTypeSelection, load: loadInvoiceType } = useInvoiceTypeStore();
  const { settings: invoiceSettings, load: loadInvoiceSettings } = useInvoiceSettingsStore();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithStatus[]>([]);

  useEffect(() => {
    loadInvoiceType();
    loadInvoiceSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(customerId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        setCustomer(found);
        const [, customerInvoices] = await Promise.all([
          loadActivity(customerId),
          listForCustomer(customerId),
        ]);
        if (cancelled) {
          return;
        }
        setInvoices(customerInvoices);
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
  }, [customerId]);

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="customer-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="customer-detail-not-found">
        <Text style={styles.errorText}>This customer no longer exists.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (status === 'error' || !customer) {
    return (
      <View style={styles.centered} testID="customer-detail-error">
        <Text style={styles.errorText}>Couldn't load this customer.</Text>
        <ActionButton label="Go back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="customer-detail-screen"
    >
      <View style={styles.card} testID="customer-detail-info">
        <Text style={styles.name}>{customer.name}</Text>
        {!!customer.phone && <SummaryRow label="Phone" value={customer.phone} />}
        {!!customer.email && <SummaryRow label="Email" value={customer.email} />}
        {!!customer.website && <SummaryRow label="Website" value={customer.website} />}
        {!!customer.address && <SummaryRow label="Address" value={customer.address} />}
        {!!customer.notes && <SummaryRow label="Notes" value={customer.notes} />}
        <SummaryRow label="Created" value={formatTimestamp(customer.createdAt)} />
      </View>

      <CustomerSummaryCard summary={summary} testID="customer-summary" />

      <View style={styles.row}>
        {!!customer.phone && (
          <ActionButton label="Call" onPress={() => openPhone(customer.phone!)} testID="action-call" />
        )}
        {!!customer.phone && (
          <ActionButton
            label="WhatsApp"
            onPress={() => openWhatsApp(customer.phone!)}
            testID="action-whatsapp"
          />
        )}
        {!!customer.email && (
          <ActionButton label="Email" onPress={() => openEmail(customer.email!)} testID="action-email" />
        )}
        {!!customer.website && (
          <ActionButton
            label="Website"
            onPress={() => openWebsite(customer.website!)}
            testID="action-website"
          />
        )}
        {!!customer.address && (
          <ActionButton
            label="Directions"
            onPress={() => openGoogleMaps({ address: customer.address })}
            testID="action-directions"
          />
        )}
      </View>

      <View style={styles.row}>
        <ActionButton
          label="Create invoice"
          variant="primary"
          onPress={() => {
            const invoiceTypeId = invoiceTypeSelection?.invoiceTypeId ?? 'general';
            const termsDays = invoiceSettings?.defaultPaymentTermsDays ?? null;
            const terms =
              termsDays != null ? (PAYMENT_TERMS_OPTIONS.find((o) => o.value === termsDays)?.label ?? null) : null;
            const dueDate = termsDays != null ? addDaysIso(todayIsoDate(), termsDays) : null;

            useInvoiceDraftStore.getState().startCreate({ invoiceTypeId, terms, dueDate });
            useInvoiceDraftStore.getState().setCustomer(customer);
            navigation.navigate('CreateInvoiceItems');
          }}
          testID="action-create-invoice"
        />
        <ActionButton
          label="Record payment"
          onPress={() =>
            navigation.navigate('InvoiceList', {
              customerId,
              onSelectInvoice: (invoice) => navigation.navigate('RecordPayment', { invoiceId: invoice.id }),
            })
          }
          testID="action-record-payment"
        />
      </View>

      <View style={styles.row}>
        <ActionButton
          label="Edit customer"
          onPress={() => navigation.navigate('EditCustomer', { customerId })}
          testID="action-edit-customer"
        />
        <ActionButton
          label="History"
          onPress={() => navigation.navigate('CustomerHistory', { customerId })}
          testID="action-view-history"
        />
      </View>

      <View style={styles.invoicesSection} testID="customer-detail-invoices">
        <Text style={styles.sectionTitle}>Invoices</Text>
        {invoices.length === 0 ? (
          <Text style={styles.emptyText}>No invoices yet.</Text>
        ) : (
          <View style={styles.invoicesList}>
            {invoices.map((entry) => (
              <InvoiceListRow
                key={entry.invoice.id}
                entry={entry}
                onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: entry.invoice.id })}
                testID={`customer-invoice-row-${entry.invoice.id}`}
              />
            ))}
          </View>
        )}
      </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  invoicesSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  invoicesList: { gap: 10 },
  emptyText: { fontSize: 13, color: colors.textMuted },
});
