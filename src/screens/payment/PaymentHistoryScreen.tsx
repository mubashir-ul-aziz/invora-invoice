import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { PaymentListRow } from '@/components/payment/PaymentListRow';
import { sumPayments } from '@/domain/payment/calculations';
import { PAYMENT_METHOD_FILTER_OPTIONS } from '@/domain/payment/types';
import type { Payment } from '@/domain/payment/types';
import type { RootStackParamList } from '@/navigation/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { usePaymentStore } from '@/state/paymentStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentHistory'>;

/**
 * Payment History: every payment recorded, across every invoice/customer,
 * newest payment date first. Restyled to match the Stitch design: a Total
 * Collected hero card (real, summed from the currently-loaded/filtered list
 * via the centralized `sumPayments` — never re-summed here), a search pill
 * + method filter chips (still store-driven, unchanged behavior), payments
 * grouped into real month sections, and a "Record Payment" FAB.
 *
 * DESIGN ONLY:
 * - "Export ledger" — no CSV/PDF export capability exists anywhere in this
 *   app (same reasoning as Invoice Detail's "Export CSV" menu item).
 * - The date-range pill ("This Month" / "Custom Range") — `PaymentFilter`
 *   has no date-range field, only `searchText`/`method`.
 * The Stitch mock's "+14.2%" trend badge and "Inflow velocity" sparkline
 * aren't reproduced at all (like Invoice List's cash-flow sparkline, no
 * historical/period-over-period data is computed anywhere) — nor are
 * per-row "Settled/Partial" status badges (see `PaymentListRow`'s doc
 * comment: that's the invoice's status, not the payment's, and would need
 * an extra per-row invoice lookup this cross-invoice list doesn't do).
 *
 * "Record Payment" has no invoice-agnostic entry point in this app
 * (`RecordPayment` always requires `{invoiceId}}`) — the FAB opens the real
 * Invoice List in picker mode first, then Record Payment for whichever
 * invoice is chosen, reusing both existing flows rather than inventing a
 * new one.
 */
export function PaymentHistoryScreen({ navigation }: Props) {
  const { status, entries, filter, error, load, setFilter } = usePaymentStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCollected = useMemo(() => sumPayments(entries), [entries]);
  const currencySymbol = useCurrencySymbol();

  const sections = useMemo(() => groupPaymentsByMonth(entries), [entries]);

  const handleRecordPayment = () => {
    navigation.navigate('InvoiceList', {
      onSelectInvoice: (invoice) => {
        navigation.navigate('RecordPayment', { invoiceId: invoice.id });
      },
    });
  };

  return (
    <View style={styles.screen} testID="payment-history-screen">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <View style={styles.titleIcon}>
              <Feather name="credit-card" size={16} color={colors.primary} />
            </View>
            <Text style={styles.title}>Payment History</Text>
          </View>
          <View style={styles.titleActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export ledger — DESIGN ONLY, no export capability exists"
              testID="action-export-ledger-design-only"
              onPress={() => Alert.alert('Not available', 'CSV/PDF export is not implemented yet.')}
              style={styles.titleActionButton}
            >
              <Feather name="upload" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {status === 'ready' && entries.length > 0 && (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Total Collected</Text>
                <Text style={styles.heroValue}>
                  {currencySymbol}{totalCollected.toFixed(2)}
                  <Text style={styles.heroValueSuffix}> total</Text>
                </Text>
              </View>
              <View style={styles.heroIcon}>
                <Feather name="dollar-sign" size={20} color={colors.primary} />
              </View>
            </View>
            <View style={styles.heroStatRow}>
              <Feather name="check-circle" size={14} color={colors.primary} />
              <Text style={styles.heroStatText}>
                {entries.length} payment{entries.length === 1 ? '' : 's'} shown
              </Text>
            </View>
          </View>
        )}

        <View style={styles.searchPill}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={filter.searchText}
            onChangeText={(text) => setFilter({ searchText: text })}
            placeholder="Search by client, invoice #, reference..."
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            testID="payment-search"
          />
        </View>

        <View style={styles.chipRow} testID="payment-method-filter">
          {PAYMENT_METHOD_FILTER_OPTIONS.map((option) => {
            const active = filter.method === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${option.label}`}
                accessibilityState={{ selected: active }}
                testID={`payment-method-filter-${option.value}`}
                onPress={() => setFilter({ method: option.value })}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Date range — DESIGN ONLY, no date-range filter exists"
          testID="action-date-range-design-only"
          onPress={() => Alert.alert('Not available', 'Filtering by date range is not implemented yet.')}
          style={styles.dateRangePill}
        >
          <Feather name="calendar" size={13} color={colors.textMuted} />
          <Text style={styles.dateRangeText}>Date range · DESIGN ONLY</Text>
        </Pressable>
      </View>

      {(status === 'loading' || status === 'idle') && (
        <View style={styles.centered} testID="payment-history-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered} testID="payment-history-error">
          <Text style={styles.errorText}>Couldn't load payments.</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <ActionButton label="Try again" onPress={load} />
        </View>
      )}

      {status === 'ready' && entries.length === 0 && (
        <View style={styles.centered} testID="payment-history-empty">
          <View style={styles.emptyIconCircle}>
            <Feather name="file-text" size={24} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No payments found</Text>
          <Text style={styles.emptyText}>
            {filter.searchText || filter.method !== 'all'
              ? 'No transactions match your search or filter selection.'
              : 'No payments have been recorded yet.'}
          </Text>
        </View>
      )}

      {status === 'ready' && entries.length > 0 && (
        <SectionList
          testID="payment-history-list"
          sections={sections}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                <View style={styles.sectionHeaderDot} />
                <Text style={styles.sectionHeaderCaption}>
                  {section.data.length} payment{section.data.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.sectionHeaderTotal}>
                {currencySymbol}{sumPayments(section.data).toFixed(2)}
                <Text style={styles.sectionHeaderTotalSuffix}> subtotal</Text>
              </Text>
            </View>
          )}
          renderItem={({ item: entry }) => (
            <PaymentListRow
              payment={entry}
              onPress={() => navigation.navigate('EditPayment', { paymentId: entry.id })}
              testID={`payment-row-${entry.id}`}
            />
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record payment"
        testID="action-record-payment"
        onPress={handleRecordPayment}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Feather name="plus" size={18} color={colors.primaryText} />
        <Text style={styles.fabText}>Record Payment</Text>
      </Pressable>
    </View>
  );
}

/** Real month-of-`paymentDate` grouping over already-loaded payments — pure client-side derivation, no fabricated data. */
function groupPaymentsByMonth(payments: Payment[]): { title: string; data: Payment[] }[] {
  const groups = new Map<string, Payment[]>();
  for (const payment of payments) {
    const key = payment.paymentDate.slice(0, 7); // YYYY-MM
    const list = groups.get(key) ?? [];
    list.push(payment);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, data]) => ({ title: formatMonthLabel(key), data }));
}

function formatMonthLabel(yearMonth: string): string {
  const date = new Date(`${yearMonth}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? yearMonth : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 10, gap: 10, backgroundColor: colors.background },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  titleActions: { flexDirection: 'row', gap: 8 },
  titleActionButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  heroValue: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2, letterSpacing: -0.5 },
  heroValueSuffix: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  heroIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatText: { fontSize: 12, color: colors.textMuted },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },

  dateRangePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  dateRangeText: { fontSize: 11, color: colors.textMuted },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted, textAlign: 'center', maxWidth: 260 },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  separator: { height: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeaderTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHeaderDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.placeholder },
  sectionHeaderCaption: { fontSize: 11, color: colors.textMuted },
  sectionHeaderTotal: { fontSize: 13, fontWeight: '600', color: colors.text },
  sectionHeaderTotalSuffix: { fontSize: 10, fontWeight: '400', color: colors.textMuted },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPressed: { opacity: 0.85 },
  fabText: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
