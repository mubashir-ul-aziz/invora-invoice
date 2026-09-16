import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { DashboardBottomNav } from '@/components/dashboard/DashboardBottomNav';
import { InvoiceListRow } from '@/components/invoice/InvoiceListRow';
import { DateSectionHeader } from '@/components/shared/DateSectionHeader';
import { PAYMENT_TERMS_OPTIONS } from '@/domain/business/types';
import { addDaysIso, todayIsoDate } from '@/domain/invoice/formMapping';
import { INVOICE_STATUS_LABELS } from '@/domain/invoice/status';
import type { InvoiceStatus } from '@/domain/invoice/types';
import { groupByDateSection } from '@/domain/shared/dateSections';
import type { RootStackParamList } from '@/navigation/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { useInvoiceStore, type InvoiceWithStatus } from '@/state/invoiceStore';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceList'>;

type StatusFilter = InvoiceStatus | 'all';
type SortMode = 'newest' | 'oldest';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: INVOICE_STATUS_LABELS.unpaid },
  { value: 'overdue', label: INVOICE_STATUS_LABELS.overdue },
  { value: 'partial', label: INVOICE_STATUS_LABELS.partial },
  { value: 'paid', label: INVOICE_STATUS_LABELS.paid },
];

/**
 * Invoice List, restyled to match the Stitch "Invoice List" design: a pill
 * search bar with a sort toggle, All/Unpaid/Overdue/Partial/Paid status pills
 * (each with a real count), a real "Total Outstanding" summary card, Stitch-
 * style invoice cards grouped into date sections, and a floating "Create
 * Invoice" button.
 *
 * Unlike the previous version, the status pills and sort are client-side
 * derivations over the already-loaded `entries` (same pattern as the
 * restyled Item/Customer List's category/status chips) instead of round-
 * tripping through `invoiceStore`'s own `filter.status` — that way every
 * pill can show its own real count at once, not just whichever status is
 * currently selected. Search still hits the store for real (`setFilter`),
 * same as before.
 *
 * The Stitch mock's "Cash flow" sparkline has no historical trend data
 * source anywhere in this app (no day-by-day payment history is computed) —
 * it's rendered as a static, clearly-labeled DESIGN ONLY placeholder rather
 * than implying a real trend. "Total Outstanding" and its "N pending or
 * overdue invoices" caption ARE real, computed from each entry's own
 * `totals`/`status`/`amountPaid`.
 *
 * "Create Invoice – Customer" (the brief's screen #2) isn't a separate
 * screen here — starting a new invoice seeds `invoiceDraftStore` and opens
 * `CustomerList` in picker mode (built for exactly this in Phase 5), then
 * forwards into `CreateInvoiceItems` once a customer is chosen.
 *
 * Doubles as an invoice **picker** (Phase 7) when `route.params.onSelectInvoice`
 * is provided — Customer Detail's "Record payment" action needs the
 * customer's own invoice picked first, and reuses this screen instead of a
 * second, near-duplicate list, mirroring `ItemListScreen`/`CustomerListScreen`'s
 * picker mode. `route.params.customerId`, when set, scopes the list to that
 * customer for as long as this screen instance is mounted — applied on mount
 * and cleared again on unmount, so it never leaks into the global filter the
 * plain "Invoices" tab shares. The status pills, sort toggle, summary card
 * and bottom nav are only shown in plain mode, not while picking.
 */
export function InvoiceListScreen({ navigation, route }: Props) {
  const onSelectInvoice = route.params?.onSelectInvoice;
  const scopedCustomerId = route.params?.customerId;
  const { status, entries, filter, error, load, setFilter } = useInvoiceStore();
  const { selection: invoiceTypeSelection, load: loadInvoiceType } = useInvoiceTypeStore();
  const { settings: invoiceSettings, load: loadInvoiceSettings } = useInvoiceSettingsStore();
  const currencySymbol = useCurrencySymbol();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

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

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<InvoiceStatus, number>> = {};
    for (const entry of entries) {
      counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  const outstandingEntries = useMemo(() => entries.filter((entry) => entry.status !== 'paid'), [entries]);
  const totalOutstanding = useMemo(
    () => outstandingEntries.reduce((sum, entry) => sum + Math.max(0, entry.totals.grandTotal - entry.amountPaid), 0),
    [outstandingEntries],
  );

  const visibleEntries = useMemo(() => {
    const list = statusFilter === 'all' ? entries : entries.filter((entry) => entry.status === statusFilter);
    return sortMode === 'newest' ? list : [...list].reverse();
  }, [entries, statusFilter, sortMode]);

  // Invoices are already sorted newest-issue-date first (`sortInvoices`), so
  // consecutive same-day entries collapse into one "Today"/"Yesterday"/date
  // section — the WhatsApp-style separator, per `DateSectionHeader`.
  const sections = useMemo(
    () => groupByDateSection(visibleEntries, (entry) => entry.invoice.issueDate),
    [visibleEntries],
  );

  const handleOpenInvoice = (entry: InvoiceWithStatus) => {
    if (onSelectInvoice) {
      // Pop this picker off the stack *before* invoking the callback: the
      // callback (e.g. "Record payment") typically pushes the next screen
      // itself, and calling goBack() after that would pop that freshly-
      // pushed screen right back off instead of this one.
      navigation.goBack();
      onSelectInvoice(entry.invoice);
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
      <View style={styles.controlBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchPill}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={filter.searchText}
              onChangeText={(text) => setFilter({ searchText: text })}
              placeholder="Search invoices, clients, INV#..."
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              testID="invoice-search"
            />
          </View>
          {!onSelectInvoice && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle sort order"
              testID="invoice-sort-toggle"
              onPress={() => setSortMode((m) => (m === 'newest' ? 'oldest' : 'newest'))}
              style={styles.sortButton}
            >
              <Feather name="repeat" size={16} color={colors.primary} />
              <Text style={styles.sortButtonText}>{sortMode === 'newest' ? 'Newest' : 'Oldest'}</Text>
            </Pressable>
          )}
        </View>

        {!onSelectInvoice && (
          <View style={styles.chipRow} testID="invoice-status-filter">
            {STATUS_FILTERS.map((option) => {
              const active = statusFilter === option.value;
              const count = option.value === 'all' ? entries.length : statusCounts[option.value] ?? 0;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter: ${option.label}`}
                  accessibilityState={{ selected: active }}
                  testID={`invoice-status-filter-${option.value}`}
                  onPress={() => setStatusFilter(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                  <Text style={[styles.chipCount, active && styles.chipCountActive]}>({count})</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {!onSelectInvoice && status === 'ready' && entries.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <View style={styles.summaryEyebrow}>
                <View style={styles.summaryDot} />
                <Text style={styles.summaryEyebrowText}>Total Outstanding</Text>
              </View>
              <Text style={styles.summaryValue}>{currencySymbol}{totalOutstanding.toFixed(2)}</Text>
              <Text style={styles.summaryCaption}>
                {outstandingEntries.length} pending or overdue invoice{outstandingEntries.length === 1 ? '' : 's'}
              </Text>
            </View>
            {/* DESIGN ONLY: no historical day-by-day payment trend is computed anywhere in this app. */}
            <View style={styles.sparkline} accessibilityLabel="Cash flow trend — DESIGN ONLY, no historical trend data exists">
              <View style={styles.sparkBars}>
                {[6, 10, 7, 14, 9, 16].map((h, i) => (
                  <View key={i} style={[styles.sparkBar, { height: h }]} />
                ))}
              </View>
            </View>
          </View>
        )}

        {!onSelectInvoice && (
          <ActionButton
            label="+ New invoice"
            variant="primary"
            onPress={handleCreate}
            testID="action-create-invoice"
          />
        )}
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
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="zap" size={24} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Need to bill a client?</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ New invoice" above to draft a quick quote or send an instant invoice.
            </Text>
          </View>
        </View>
      )}

      {status === 'ready' && entries.length > 0 && visibleEntries.length === 0 && (
        <View style={styles.centered} testID="invoice-list-no-filter-matches">
          <Feather name="file-text" size={26} color={colors.textMuted} />
          <Text style={styles.emptyText}>No invoices match your search or filter.</Text>
          <ActionButton
            label="Show all invoices"
            onPress={() => {
              setStatusFilter('all');
              setFilter({ searchText: '' });
            }}
          />
        </View>
      )}

      {status === 'ready' && visibleEntries.length > 0 && (
        <SectionList
          testID="invoice-list"
          sections={sections}
          keyExtractor={(entry) => entry.invoice.id}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionHeader={({ section }) => <DateSectionHeader label={section.title} />}
          renderItem={({ item: entry }) => (
            <InvoiceListRow
              entry={entry}
              onPress={() => handleOpenInvoice(entry)}
              testID={`invoice-row-${entry.invoice.id}`}
            />
          )}
        />
      )}

      {!onSelectInvoice && (
        <DashboardBottomNav
          activeTab="invoices"
          onDashboard={() => navigation.navigate('Dashboard')}
          onCustomers={() => navigation.navigate('CustomerList')}
          onSettings={() => navigation.navigate('Settings')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controlBar: { padding: 16, paddingBottom: 10, gap: 10, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  sortButtonText: { fontSize: 12, fontWeight: '700', color: colors.text },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  chipCount: { fontSize: 11, fontWeight: '500', color: colors.placeholder },
  chipCountActive: { color: colors.primaryText, opacity: 0.8 },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  summaryLeft: { flex: 1, gap: 2 },
  summaryEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  summaryEyebrowText: { fontSize: 11, color: colors.textMuted },
  summaryValue: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  summaryCaption: { fontSize: 11, color: colors.textMuted },
  sparkline: { alignItems: 'flex-end', gap: 3 },
  sparkBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    height: 24,
  },
  sparkBar: { width: 4, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.6 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  emptyCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 270 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  separator: { height: 8 },
});
