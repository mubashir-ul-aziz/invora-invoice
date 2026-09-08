import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { OptionPicker } from '@/components/business/OptionPicker';
import { InvoiceListRow } from '@/components/invoice/InvoiceListRow';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import { INVOICE_STATUS_OPTIONS } from '@/domain/invoice/status';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceList'>;

/**
 * Invoice List. "Create Invoice – Customer" (the brief's screen #2) isn't a
 * separate screen here — starting a new invoice seeds `invoiceDraftStore`
 * and opens `CustomerList` in picker mode (built for exactly this in Phase
 * 5), then forwards into `CreateInvoiceItems` once a customer is chosen.
 *
 * Doubles as an invoice **picker** (Phase 7) when `route.params.onSelectInvoice`
 * is provided — Customer Detail's "Record payment" action needs the
 * customer's own invoice picked first, and reuses this screen instead of a
 * second, near-duplicate list, mirroring `ItemListScreen`/`CustomerListScreen`'s
 * picker mode. `route.params.customerId`, when set, scopes the list to that
 * customer for as long as this screen instance is mounted — applied on mount
 * and cleared again on unmount, so it never leaks into the global filter the
 * plain "Invoices" tab shares.
 */
export function InvoiceListScreen({ navigation, route }: Props) {
  const onSelectInvoice = route.params?.onSelectInvoice;
  const scopedCustomerId = route.params?.customerId;
  const { status, entries, filter, error, load, setFilter } = useInvoiceStore();
  const { selection: invoiceTypeSelection, load: loadInvoiceType } = useInvoiceTypeStore();
  const { settings: invoiceSettings, load: loadInvoiceSettings } = useInvoiceSettingsStore();

  useEffect(() => {
    if (scopedCustomerId) {
      setFilter({ customerId: scopedCustomerId });
    } else {
      load();
    }
    loadInvoiceType();
    loadInvoiceSettings();
    return () => {
      if (scopedCustomerId) {
        setFilter({ customerId: undefined });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedCustomerId]);

  const handleOpenInvoice = (entry: InvoiceWithStatus) => {
    if (onSelectInvoice) {
      onSelectInvoice(entry.invoice);
      navigation.goBack();
      return;
    }
    navigation.navigate('InvoiceDetail', { invoiceId: entry.invoice.id });
  };

  const handleCreate = () => {
    const invoiceTypeId = invoiceTypeSelection?.invoiceTypeId ?? 'general';
    const termsDays = invoiceSettings?.defaultPaymentTermsDays ?? null;
    const terms = termsDays != null ? (PAYMENT_TERMS_OPTIONS.find((o) => o.value === termsDays)?.label ?? null) : null;
    const dueDate = termsDays != null ? addDaysIso(todayIsoDate(), termsDays) : null;

    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId, terms, dueDate });
    navigation.navigate('CustomerList', {
      onSelectCustomer: (customer) => {
        useInvoiceDraftStore.getState().setCustomer(customer);
        navigation.navigate('CreateInvoiceItems');
      },
    });
  };

  return (
    <View style={styles.screen} testID="invoice-list-screen">
      <View style={styles.header}>
        <TextInput
          value={filter.searchText}
          onChangeText={(text) => setFilter({ searchText: text })}
          placeholder="Search by invoice number or customer"
          placeholderTextColor={colors.placeholder}
          style={styles.search}
          testID="invoice-search"
        />
        <OptionPicker
          label="Status"
          options={INVOICE_STATUS_OPTIONS}
          value={filter.status}
          onChange={(value) => setFilter({ status: value })}
          testID="invoice-status-filter"
        />
        <ActionButton
          label="+ New invoice"
          variant="primary"
          onPress={handleCreate}
          testID="action-create-invoice"
        />
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="invoice-list-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="invoice-list-error">
          <Text style={styles.errorText}>Couldn't load invoices.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={load} />
        </View>
      )}

      {status === 'ready' && entries.length === 0 && (
        <View style={styles.centered} testID="invoice-list-empty">
          <Text style={styles.emptyText}>
            {filter.searchText || filter.status !== 'all'
              ? 'No invoices match your search or filter.'
              : "You haven't created any invoices yet."}
          </Text>
        </View>
      )}

      {status === 'ready' && entries.length > 0 && (
        <FlatList
          testID="invoice-list"
          data={entries}
          keyExtractor={(entry) => entry.invoice.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: entry }) => (
            <InvoiceListRow
              entry={entry}
              onPress={() => handleOpenInvoice(entry)}
              testID={`invoice-row-${entry.invoice.id}`}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, gap: 12 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
});
